"""Explicit offline re-anchoring; existing strict validation remains unchanged."""
import copy
import hashlib
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[1] / 'comparison-preflight-2026-10-19'
sys.path.insert(0, str(BASE))
from comparison import normalize, validate_claim


def align_proposals(source, body):
    """Correct only numeric offsets of a unique, identical source quotation.

    Already-valid spans stay as supplied. Invalid spans never choose between
    repeated quotations, normalize Unicode/whitespace, expand evidence, change
    semantics or prove subject/support/eligibility. Every change is explicit.
    """
    corrected = copy.deepcopy(body)
    audit = []
    result = {'version':'unique-exact-quote-v1','body':corrected,'audit':audit,
              'allAnchorsValid':False,'nativeEligible':False,
              'assurance':'Literal source anchoring only; subject, qualifiers and semantic support remain separate.'}
    if not isinstance(source,dict) or not isinstance(source.get('text'),str):
        result['normalization']={'claims':[],'material':None,'errors':['invalid_source']}
        return result
    text = source['text']
    try:
        text.encode('utf-16-le')
        result['sourceTextUtf8Sha256']=hashlib.sha256(text.encode('utf-8')).hexdigest()
    except UnicodeError:
        result['normalization']={'claims':[],'material':None,'errors':['invalid_source_unicode']}
        return result
    if (not isinstance(body,dict) or set(body)!={'claims','material','overflow'} or
        type(body['material']) is not bool or type(body['overflow']) is not bool or
        not isinstance(body['claims'],list) or body['overflow'] or len(body['claims'])>32):
        result['normalization']=normalize(source,body)
        return result
    for index, original in enumerate(body['claims']):
        item={'index':index,'action':'held','reason':None}
        audit.append(item)
        try:
            validate_claim(source,original)
        except (ValueError,TypeError,KeyError):
            pass
        else:
            item.update(action='unchanged',reason='existing_strict_anchor_valid')
            continue
        evidence=original.get('evidence') if isinstance(original,dict) else None
        if (not isinstance(evidence,dict) or set(evidence)!={'start','end','text'} or
            type(evidence['start']) is not int or type(evidence['end']) is not int or
            evidence['start']<0 or evidence['end']<=evidence['start'] or
            not isinstance(evidence['text'],str) or not evidence['text']):
            item['reason']='invalid_evidence_shape'
            continue
        quote=evidence['text'];first=text.find(quote)
        if first<0:
            item['reason']='exact_quote_absent'
            continue
        # Advance one code point so overlapping repetitions remain ambiguous.
        if text.find(quote,first+1)>=0:
            item['reason']='exact_quote_ambiguous'
            continue
        try:
            start=len(text[:first].encode('utf-16-le'))//2
            end=start+len(quote.encode('utf-16-le'))//2
            candidate=copy.deepcopy(original)
            candidate['evidence']={'start':start,'end':end,'text':quote}
            validate_claim(source,candidate)
        except (ValueError,TypeError,KeyError):
            item['reason']='non_anchor_validation_failed'
            continue
        corrected['claims'][index]=candidate
        item.update(action='reanchored',reason='unique_exact_source_quote',
                    beforeEvidence=copy.deepcopy(evidence),afterEvidence=copy.deepcopy(candidate['evidence']))
    result['normalization']=normalize(source,corrected)
    result['allAnchorsValid']=not result['normalization']['errors'] and not any(a['action']=='held' for a in audit)
    return result
