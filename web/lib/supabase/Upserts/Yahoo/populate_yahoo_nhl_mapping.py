#!/usr/bin/env python3
# /Users/tim/Desktop/fhfhockey.com/web/lib/supabase/Upserts/Yahoo/populate_yahoo_nhl_mapping.py

import os
import logging
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from fuzzywuzzy import fuzz, process
import re
import json
from pathlib import Path

# -----------------------------------------------------------------------------
# CONFIG & ENV
# -----------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

ENV_FILE = "/Users/tim/Desktop/fhfhockey.com/web/.env.local"
load_dotenv(ENV_FILE)

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('NEXT_PUBLIC_SUPABASE_PUBLIC_KEY')

if not all([SUPABASE_URL, SUPABASE_KEY]):
    logging.error("Missing environment variables. Need NEXT_PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_PUBLIC_KEY")
    exit(1)

logging.info(f"Using Supabase URL: {SUPABASE_URL}")
logging.info(f"Using key type: {'SERVICE_ROLE' if os.getenv('SUPABASE_SERVICE_ROLE_KEY') else 'PUBLIC'}")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# -----------------------------------------------------------------------------
# HELPER FUNCTIONS
# -----------------------------------------------------------------------------
def load_normalization_spec():
    spec_path = Path(__file__).resolve().parent / 'player_name_normalization_spec.json'
    try:
        with open(spec_path, 'r', encoding='utf-8') as fh:
            return json.load(fh)
    except Exception:
        logging.warning('Could not load normalization spec; falling back to defaults')
        return {}


NORM_SPEC = load_normalization_spec()

def split_name_first_last(name: str):
    if not name:
        return '', ''
    parts = re.sub(r"[\s]+", " ", name.strip()).split(" ")
    if not parts:
        return '', ''
    if len(parts) == 1:
        return parts[0], parts[0]
    return " ".join(parts[:-1]), parts[-1]

def last_name_tokens(name: str):
    _, last = split_name_first_last(name)
    if not last:
        return set()
    subs = re.split(r"[-\s]", last)
    tokens = set()
    for s in subs:
        s = s.strip()
        if not s:
            continue
        tokens.add(normalize_name(s))
    return tokens

def best_last_name_match(source_name: str, candidates: dict):
    """Find best candidate by comparing only last name tokens.

    candidates: dict[id] -> player dict with 'name'
    Returns (id, last_name_score, first_name_score) or (None, None, None)
    """
    src_last_tokens = last_name_tokens(source_name)
    src_first, _ = split_name_first_last(source_name)
    if not src_last_tokens:
        return None, None, None
    best_id = None
    best_last = -1
    best_first = -1
    for pid, p in candidates.items():
        cand_name = p.get('name') or ''
        cand_last_tokens = last_name_tokens(cand_name)
        if not cand_last_tokens:
            continue
        max_last = 0
        for a in src_last_tokens:
            for b in cand_last_tokens:
                try:
                    sc = fuzz.ratio(a, b)
                except Exception:
                    sc = 0
                if sc > max_last:
                    max_last = sc
        cand_first, _ = split_name_first_last(cand_name)
        try:
            first_sc = fuzz.partial_ratio(src_first, cand_first)
        except Exception:
            first_sc = 0
        if (max_last > best_last) or (max_last == best_last and first_sc > best_first):
            best_id, best_last, best_first = pid, max_last, first_sc
    if best_id is None:
        return None, None, None
    return best_id, best_last, best_first

def load_name_overrides():
    """Load manual name mapping overrides if present.

    Expected JSON schema: list of entries or {"data": [...]} with keys like
      {
        "unmatchedName": "...",
        "correctedName": "...",
        "sourceToUpsertTo": "yahoo_players|projections|nhl",
        "notes": "..."
      }

    We build two lookup maps (normalized keys):
      - forward_overrides: NHL -> Yahoo (key=normalized unmatchedName, val=correctedName)
      - reverse_overrides: Yahoo -> NHL (key=normalized unmatchedName, val=correctedName)
    """
    base = Path(__file__).resolve().parent
    overrides_path = base / 'name_mapping_overrides.json'
    todo_path = base / 'name_mapping_todo.json'
    forward_overrides = {}
    reverse_overrides = {}

    def merge_entries(entries):
        nonlocal forward_overrides, reverse_overrides
        if not isinstance(entries, list):
            return
        for entry in entries:
            e = entry or {}
            data = e.get('data') if isinstance(e, dict) and 'data' in e else e
            unmatched = normalize_name((data or {}).get('unmatchedName') or '')
            corrected = (data or {}).get('correctedName') or ''
            target = ((data or {}).get('sourceToUpsertTo') or '').lower()
            if not unmatched or not corrected:
                continue
            if 'yahoo' in target:
                forward_overrides[unmatched] = corrected
            elif ('nhl' in target) or ('projection' in target):
                reverse_overrides[unmatched] = corrected
            else:
                forward_overrides[unmatched] = corrected
                reverse_overrides[unmatched] = corrected

    # Prefer explicit overrides file if present
    try:
        if overrides_path.exists():
            with open(overrides_path, 'r', encoding='utf-8') as fh:
                raw = json.load(fh)
            merge_entries(raw.get('data') if isinstance(raw, dict) else raw)
    except Exception as e:
        logging.warning(f"Failed to load overrides JSON: {e}")

    # Also fold in any corrections directly placed in the TODO file
    try:
        if todo_path.exists():
            with open(todo_path, 'r', encoding='utf-8') as fh:
                raw = json.load(fh)
            merge_entries(raw.get('data') if isinstance(raw, dict) else raw)
    except Exception as e:
        logging.warning(f"Failed to read name_mapping_todo.json: {e}")
    
    return forward_overrides, reverse_overrides


def normalize_name(name: str) -> str:
    """Apply normalization rules from spec to produce a canonical key."""
    if not name:
        return ""
    s = name.lower().strip()
    # remove punctuation
    punct = NORM_SPEC.get('punctuation_regex', "[.'`-]")
    s = re.sub(punct, '', s)
    # replace mapped chars
    for k, v in NORM_SPEC.get('replace_chars', {}).items():
        s = s.replace(k, v)
    # collapse whitespace
    s = ' '.join(s.split())
    # strip suffixes
    for suf in NORM_SPEC.get('strip_suffixes', []):
        s = re.sub(rf"\s+{re.escape(suf)}$", '', s)
    # alias map
    alias = NORM_SPEC.get('alias_map', {})
    if s in alias:
        s = alias[s]
    return s

def get_nhl_players():
    """Fetch NHL player data from projection sources."""
    logging.info("Fetching NHL players from projection sources...")
    
    # Get players from your actual projection tables based on the config
    projection_tables = [
        'projections_apples_ginos',
        'projections_cullen', 
        'projections_cullen_goalies',
        'projections_cullen_top_400',
        'projections_dom_skaters',
        'projections_dom_goalies',
        'projections_dtz_skaters',
        'projections_dtz_goalies'
    ]
    
    all_nhl_players = {}
    
    for table in projection_tables:
        try:
            logging.info(f"Fetching from {table}...")
            
            # Use different column names based on the table
            if table == 'projections_cullen_goalies':
                # Known: no Position column
                select_cols = "player_id, Goalie, Team_Abbreviation"
                name_col = 'Goalie'
            elif table == 'projections_dom_goalies':
                # Known: no Team_Abbreviation column
                select_cols = "player_id, Player_Name, Position"
                name_col = 'Player_Name'
            elif table == 'projections_dom_skaters':
                # Known: no Team_Abbreviation column
                select_cols = "player_id, Player_Name, Position"
                name_col = 'Player_Name'
            else:
                # Default case includes team and position
                select_cols = "player_id, Player_Name, Team_Abbreviation, Position"
                name_col = 'Player_Name'
            
            resp = supabase.table(table).select(select_cols).execute()
            
            for player in resp.data:
                nhl_id = player.get('player_id')
                name = player.get(name_col)
                team = player.get('Team_Abbreviation')
                position = player.get('Position')
                
                if nhl_id and name:
                    if nhl_id not in all_nhl_players:
                        all_nhl_players[nhl_id] = {
                            'nhl_id': nhl_id,
                            'name': name,
                            'team': team,
                            'position': position,
                            'clean_name': normalize_name(name)
                        }
        except Exception as e:
            logging.warning(f"Could not fetch from {table}: {e}")
            continue
    
    logging.info(f"Found {len(all_nhl_players)} unique NHL players")
    return all_nhl_players

def get_yahoo_players():
    """Fetch Yahoo player data."""
    logging.info("Fetching Yahoo players...")
    
    all_yahoo_players = {}
    page_size = 1000
    start = 0
    
    while True:
        resp = supabase.table("yahoo_players") \
                       .select("player_id, full_name, editorial_team_abbreviation, display_position") \
                       .range(start, start + page_size - 1) \
                       .execute()
        
        data = resp.data
        if not data:
            break
            
        for player in data:
            yahoo_id = player.get('player_id')
            name = player.get('full_name')
            team = player.get('editorial_team_abbreviation')
            position = player.get('display_position')
            
            if yahoo_id and name:
                all_yahoo_players[yahoo_id] = {
                    'yahoo_id': yahoo_id,
                    'name': name,
                    'team': team,
                    'position': position,
                        'clean_name': normalize_name(name)
                }
        
        start += page_size
        if len(data) < page_size:
            break
    
    logging.info(f"Found {len(all_yahoo_players)} Yahoo players")
    return all_yahoo_players

def analyze_yahoo_to_nhl(nhl_players, yahoo_players, forward_mappings, reverse_overrides=None):
    """Analyze matches in the reverse direction (Yahoo -> NHL).

    Returns a tuple: (reverse_unmatched, reverse_only_matches)
      - reverse_unmatched: list of Yahoo players we cannot match to NHL
      - reverse_only_matches: list of matches found only in reverse pass
    """
    logging.info("Analyzing reverse direction (Yahoo -> NHL)...")

    nhl_name_to_id = {p['clean_name']: pid for pid, p in nhl_players.items()}
    forward_pairs = set((m['nhl_player_id'], m['yahoo_player_id']) for m in forward_mappings)

    reverse_unmatched = []
    reverse_only_matches = []

    nhl_names_list = [p['name'] for p in nhl_players.values()]

    for yahoo_id, y in yahoo_players.items():
        raw_name = y['name']
        norm = y['clean_name']

        # Manual override first
        nhl_id = None
        matched_conf = None
        if reverse_overrides:
            corrected = reverse_overrides.get(norm)
            if corrected:
                corr_norm = normalize_name(corrected)
                nhl_id = nhl_name_to_id.get(corr_norm)
                matched_conf = 100.0 if nhl_id else None

        # Deterministic exact normalized match
        if not nhl_id:
            nhl_id = nhl_name_to_id.get(norm)
            matched_conf = 100.0 if nhl_id else None

        # Alias deterministic
        if not nhl_id:
            alias_map = NORM_SPEC.get('alias_map', {})
            alias_norm = alias_map.get(norm)
            if alias_norm and alias_norm in nhl_name_to_id:
                nhl_id = nhl_name_to_id[alias_norm]
                matched_conf = 100.0

        # Fuzzy fallback
        if not nhl_id:
            match_result = process.extractOne(
                raw_name,
                nhl_names_list,
                scorer=fuzz.token_set_ratio,
                score_cutoff=85,
            )
            if match_result:
                matched_name, conf = match_result
                # locate NHL id by matched name
                for pid, p in nhl_players.items():
                    if p.get('name') == matched_name:
                        nhl_id = pid
                        matched_conf = float(conf)
                        break

        # Liberal last-name-only fallback (Yahoo -> NHL)
        if not nhl_id:
            cand_id, ln_score, fn_score = best_last_name_match(raw_name, nhl_players)
            if cand_id is not None and ln_score is not None and ln_score >= 90:
                nhl_id = cand_id
                matched_conf = float(ln_score)

        if nhl_id:
            pair = (str(nhl_id), yahoo_id)
            if pair not in forward_pairs:
                reverse_only_matches.append({
                    'nhl_player_id': str(nhl_id),
                    'nhl_player_name': nhl_players[nhl_id]['name'],
                    'yahoo_player_id': yahoo_id,
                    'yahoo_player_name': raw_name,
                    'match_confidence': matched_conf,
                })
        else:
            reverse_unmatched.append({
                'yahoo_player_id': yahoo_id,
                'yahoo_player_name': raw_name,
                'yahoo_normalized': norm,
                'team': y.get('team'),
                'position': y.get('position'),
            })

    logging.info(
        f"Reverse analysis complete: {len(reverse_unmatched)} unmatched Yahoo, {len(reverse_only_matches)} reverse-only matches"
    )
    return reverse_unmatched, reverse_only_matches

def match_players(nhl_players, yahoo_players, forward_overrides=None):
    """Match NHL players to Yahoo players using fuzzy name matching.

    Returns a tuple: (mappings, unmatched)
      - mappings: list of matched mapping dicts ready for upsert
      - unmatched: list of dicts describing NHL players we failed to match
    """
    logging.info("Matching NHL players to Yahoo players...")
    
    mappings = []
    unmatched = []
    yahoo_names = {pid: player['clean_name'] for pid, player in yahoo_players.items()}
    yahoo_name_to_id = {player['clean_name']: pid for pid, player in yahoo_players.items()}
    
    matched_count = 0
    unmatched_count = 0
    
    for nhl_id, nhl_player in nhl_players.items():
        raw_nhl_name = nhl_player['name']
        nhl_name = normalize_name(raw_nhl_name)

        # Manual override (NHL -> Yahoo)
        if forward_overrides:
            corrected = forward_overrides.get(nhl_name)
            if corrected:
                corrected_norm = normalize_name(corrected)
                yahoo_id = yahoo_name_to_id.get(corrected_norm)
                if not yahoo_id:
                    # fallback fuzzy on corrected label
                    match_corr = process.extractOne(
                        corrected,
                        [p['name'] for p in yahoo_players.values()],
                        scorer=fuzz.token_set_ratio,
                        score_cutoff=80,
                    )
                    if match_corr:
                        matched_name, _ = match_corr
                        for pid, p in yahoo_players.items():
                            if p.get('name') == matched_name:
                                yahoo_id = pid
                                break
                if yahoo_id:
                    yahoo_player = yahoo_players[yahoo_id]
                    mappings.append({
                        'nhl_player_id': str(nhl_id),
                        'yahoo_player_id': yahoo_id,
                        'nhl_player_name': nhl_player['name'],
                        'yahoo_player_name': yahoo_player['name'],
                        'nhl_team_abbreviation': nhl_player.get('team'),
                        'mapped_position': nhl_player.get('position'),
                        'match_confidence': 100.0,
                    })
                    matched_count += 1
                    continue

        # Deterministic exact (normalized) match
        if nhl_name in yahoo_name_to_id:
            yahoo_id = yahoo_name_to_id[nhl_name]
            yahoo_player = yahoo_players[yahoo_id]
            mappings.append({
                'nhl_player_id': str(nhl_id),
                'yahoo_player_id': yahoo_id,
                'nhl_player_name': nhl_player['name'],
                'yahoo_player_name': yahoo_player['name'],
                'nhl_team_abbreviation': nhl_player.get('team'),
                'yahoo_team': yahoo_player.get('team'),
                'mapped_position': nhl_player.get('position'),
                'match_confidence': 100.0,
            })
            matched_count += 1
            continue

        # Try alias map deterministic
        alias_map = NORM_SPEC.get('alias_map', {})
        if nhl_name in alias_map:
            alias_norm = alias_map[nhl_name]
            if alias_norm in yahoo_name_to_id:
                yahoo_id = yahoo_name_to_id[alias_norm]
                yahoo_player = yahoo_players[yahoo_id]
                mappings.append({
                    'nhl_player_id': str(nhl_id),
                    'yahoo_player_id': yahoo_id,
                    'nhl_player_name': nhl_player['name'],
                    'yahoo_player_name': yahoo_player['name'],
                    'nhl_team_abbreviation': nhl_player.get('team'),
                    'yahoo_team': yahoo_player.get('team'),
                    'mapped_position': nhl_player.get('position'),
                    'match_confidence': 100.0,
                })
                matched_count += 1
                continue

        # Fuzzy matching fallback
        match_result = process.extractOne(
            raw_nhl_name, 
            [p['name'] for p in yahoo_players.values()], 
            scorer=fuzz.token_set_ratio,
            score_cutoff=85  # High threshold for confidence
        )

        if match_result:
            matched_name, confidence = match_result
            # find the yahoo id for this matched display name
            yahoo_id = None
            for pid, p in yahoo_players.items():
                if p.get('name') == matched_name:
                    yahoo_id = pid
                    break
            if yahoo_id:
                yahoo_player = yahoo_players[yahoo_id]
                mappings.append({
                    'nhl_player_id': str(nhl_id),
                    'yahoo_player_id': yahoo_id,
                    'nhl_player_name': nhl_player['name'],
                    'yahoo_player_name': yahoo_player['name'],
                    'nhl_team_abbreviation': nhl_player.get('team'),
                    'yahoo_team': yahoo_player.get('team'),
                    'mapped_position': nhl_player.get('position'),
                    'match_confidence': float(confidence),
                })
                matched_count += 1
                continue

        # Liberal last-name-only fallback to cover nickname first-name differences
        cand_id, ln_score, fn_score = best_last_name_match(raw_nhl_name, yahoo_players)
        if cand_id is not None and ln_score is not None and ln_score >= 90:
            yahoo_player = yahoo_players[cand_id]
            mappings.append({
                'nhl_player_id': str(nhl_id),
                'yahoo_player_id': cand_id,
                'nhl_player_name': nhl_player['name'],
                'yahoo_player_name': yahoo_player['name'],
                'nhl_team_abbreviation': nhl_player.get('team'),
                'yahoo_team': yahoo_player.get('team'),
                'mapped_position': nhl_player.get('position'),
                'match_confidence': float(ln_score),
            })
            matched_count += 1
            continue

        # No match found — queue unmatched
        logging.debug(f"No match found for NHL player: {nhl_player['name']}")
        unmatched_count += 1
        unmatched.append({
            'nhl_player_id': str(nhl_id),
            'nhl_player_name': nhl_player['name'],
            'nhl_normalized': nhl_name,
            'team': nhl_player.get('team'),
            'position': nhl_player.get('position'),
        })
        # persist unmatched suggestion row with empty candidates for now
        try:
            spec_norm = nhl_name
            resp = supabase.table('yahoo_nhl_player_map_unmatched').insert({
                'nhl_player_id': str(nhl_id),
                'nhl_player_name': nhl_player['name'],
                'nhl_normalized': spec_norm,
                'candidate_yahoo': [],
            }).execute()
            if hasattr(resp, 'error') and resp.error:
                logging.warning('Could not insert unmatched row for %s: %s', nhl_player['name'], resp.error)
        except Exception as e:
            logging.warning('Exception while inserting unmatched for %s: %s', nhl_player['name'], e)
    
    logging.info(f"Matched {matched_count} players, {unmatched_count} unmatched")
    return mappings, unmatched

def upsert_mappings(mappings):
    """Insert mappings into base table yahoo_nhl_player_map.

    Note: yahoo_nhl_player_map_mat is a materialized view and cannot be written to.
    """
    if not mappings:
        logging.info("No mappings to upsert.")
        return
    
    try:
        # Upsert in batches to avoid hitting Supabase limits
        batch_size = 1000
        total_batches = (len(mappings) + batch_size - 1) // batch_size
        
        for i in range(0, len(mappings), batch_size):
            raw_batch = mappings[i:i + batch_size]
            # Whitelist columns for base table yahoo_nhl_player_map
            allowed_keys = {
                'nhl_player_id',
                'nhl_player_name',
                'nhl_team_abbreviation',
                'yahoo_player_id',
                'yahoo_player_name',
                'yahoo_team',
            }
            batch = [
                {k: v for k, v in rec.items() if k in allowed_keys}
                for rec in raw_batch
            ]
            batch_num = (i // batch_size) + 1
            
            logging.info(f"Upserting batch {batch_num}/{total_batches} ({len(batch)} records)")
            
            # Insert into base table (materialized view cannot be updated)
            try:
                resp = supabase.table("yahoo_nhl_player_map").upsert(batch).execute()
            except Exception as e:
                logging.error(f"Error upserting batch {batch_num} into yahoo_nhl_player_map: {e}")
                continue
            
            if hasattr(resp, "error") and resp.error:
                logging.error(f"Error upserting batch {batch_num}: {resp.error}")
            else:
                logging.info(f"Successfully upserted batch {batch_num}")
                
    except Exception as e:
        logging.error(f"Exception while upserting mappings: {e}")

# -----------------------------------------------------------------------------
# MAIN
# -----------------------------------------------------------------------------
def main():
    start_time = datetime.now()
    
    # 1. Fetch NHL players from projection sources
    nhl_players = get_nhl_players()
    if not nhl_players:
        logging.error("No NHL players found. Check your projection source tables.")
        return
    
    # 2. Fetch Yahoo players
    yahoo_players = get_yahoo_players()
    if not yahoo_players:
        logging.error("No Yahoo players found. Run yahooAPI.py first to populate yahoo_players table.")
        return
    
    # Load manual overrides if present
    forward_overrides, reverse_overrides = load_name_overrides()
    # 3. Match players using fuzzy name matching (with overrides)
    mappings, unmatched = match_players(nhl_players, yahoo_players, forward_overrides)
    
    # 4. Upsert mappings to database
    upsert_mappings(mappings)
    
    # 5. Output unmatched list to terminal and JSON for review (forward: NHL -> Yahoo)
    try:
        script_dir = Path(__file__).resolve().parent
        out_path = script_dir / 'unmatched_yahoo_nhl_mapping.json'
        with open(out_path, 'w', encoding='utf-8') as fh:
            json.dump(unmatched, fh, indent=2, ensure_ascii=False)
        logging.info(f"Wrote {len(unmatched)} unmatched entries to {out_path}")
        if unmatched:
            # Also log a concise preview of names
            preview = [u.get('nhl_player_name') for u in unmatched[:20]]
            logging.info(f"Unmatched sample ({min(20, len(preview))} shown): {preview}")
    except Exception as e:
        logging.warning(f"Failed to write unmatched JSON: {e}")
    
    # 6. Reverse direction analysis (Yahoo -> NHL) and outputs
    try:
        reverse_unmatched, reverse_only = analyze_yahoo_to_nhl(nhl_players, yahoo_players, mappings, reverse_overrides)
        script_dir = Path(__file__).resolve().parent
        rev_unmatched_path = script_dir / 'unmatched_yahoo_to_nhl_mapping.json'
        rev_only_path = script_dir / 'reverse_only_matches.json'
        with open(rev_unmatched_path, 'w', encoding='utf-8') as fh:
            json.dump(reverse_unmatched, fh, indent=2, ensure_ascii=False)
        with open(rev_only_path, 'w', encoding='utf-8') as fh:
            json.dump(reverse_only, fh, indent=2, ensure_ascii=False)
        logging.info(
            f"Reverse outputs: {len(reverse_unmatched)} unmatched -> {rev_unmatched_path}, {len(reverse_only)} reverse-only -> {rev_only_path}"
        )
        if reverse_unmatched:
            preview = [u.get('yahoo_player_name') for u in reverse_unmatched[:20]]
            logging.info(f"Reverse unmatched sample ({min(20, len(preview))} shown): {preview}")
    except Exception as e:
        logging.warning(f"Failed reverse analysis outputs: {e}")
    
    # 7. Produce a consolidated manual mapping TODO file combining both directions
    try:
        script_dir = Path(__file__).resolve().parent
        todo_path = script_dir / 'name_mapping_todo.json'
        todo_entries = []
        for u in unmatched:
            note_text = "Need Yahoo version of name in 'correctedName'."
            todo_entries.append({
                'data': {
                    'unmatchedName': u.get('nhl_player_name'),
                    'correctedName': '',
                    'sourceToUpsertTo': 'yahoo_players',
                    'direction': 'NHL->Yahoo',
                    'normalized': u.get('nhl_normalized'),
                    'notes': note_text
                }
            })
        # If reverse_unmatched is not in scope due to earlier exception, default to []
        try:
            _rev_unmatched = reverse_unmatched
        except Exception:
            _rev_unmatched = []
        for u in _rev_unmatched:
            note_text = "Need NHL/Projections version of name in 'correctedName'."
            todo_entries.append({
                'data': {
                    'unmatchedName': u.get('yahoo_player_name'),
                    'correctedName': '',
                    'sourceToUpsertTo': 'projections',
                    'direction': 'Yahoo->NHL',
                    'normalized': u.get('yahoo_normalized'),
                    'notes': note_text
                }
            })
        with open(todo_path, 'w', encoding='utf-8') as fh:
            json.dump(todo_entries, fh, indent=2, ensure_ascii=False)
        logging.info(f"Wrote consolidated mapping TODOs to {todo_path}")
    except Exception as e:
        logging.warning(f"Failed to write name_mapping_todo.json: {e}")
    
    # Timer
    elapsed = datetime.now() - start_time
    minutes = int(elapsed.total_seconds() // 60)
    seconds = elapsed.total_seconds() % 60
    logging.info(f"Completed in {minutes} min {seconds:.2f} sec.")

if __name__ == "__main__":
    main()
