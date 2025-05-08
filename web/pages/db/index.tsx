// /Users/tim/Desktop/FHFH/fhfhockey.com/web/pages/db/index.tsx

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Typography,
  TextField
} from "@mui/material";
import Link from "next/link";
import { useUser } from "contexts/AuthProviderContext"; // Assuming you have this for role checking

import Grid from "@mui/material/Unstable_Grid2"; // Grid version 2

import { TextBanner } from "components/Banner/Banner";
import Container from "components/Layout/Container";
import supabase, { doPOST } from "lib/supabase";
import { useSnackbar } from "notistack";
import useCurrentSeason from "hooks/useCurrentSeason";
import { color } from "d3";

export default function Page() {
  const { enqueueSnackbar } = useSnackbar();
  const user = useUser(); // Get user from context
  const isAdmin = user?.role === "admin";

  const [numPlayers, setNumPlayers] = useState(0);
  const [numSeasons, setNumSeasons] = useState(0);
  const [numTeams, setNumTeams] = useState(0);
  const [numGames, setNumGames] = useState(0);
  const [games, setGames] = useState<{ id: number; date: string }[]>([]);
  const [powerPlayInput, setPowerPlayInput] = useState<string>("all"); // State for gameId input
  const [shiftChartsInput, setShiftChartsInput] = useState<string>("all"); // State for Shift Charts input
  const [nstTeamStatsInput, setNstTeamStatsInput] = useState<string>("all"); // State for NST tables
  const [standingsDetailsInput, setStandingsDetailsInput] =
    useState<string>("all");

  const season = useCurrentSeason();
  console.log(season);

  async function updatePlayers() {
    try {
      const { message, success } = await doPOST("/api/v1/db/update-players");
      enqueueSnackbar(message, {
        variant: success ? "success" : "error"
      });
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error"
      });
    }
  }

  async function updateSeasons() {
    try {
      const { message, success } = await doPOST("/api/v1/db/update-seasons");
      enqueueSnackbar(message, {
        variant: success ? "success" : "error"
      });
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error"
      });
    }
  }

  async function updateTeams() {
    try {
      const { message, success } = await doPOST("/api/v1/db/update-teams");
      enqueueSnackbar(message, {
        variant: success ? "success" : "error"
      });
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error"
      });
    }
  }

  async function updateGames() {
    try {
      const { message, success } = await doPOST("/api/v1/db/update-games");
      enqueueSnackbar(message, {
        variant: success ? "success" : "error"
      });
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error"
      });
    }
  }

  async function updateStats() {
    try {
      if (games.length) {
        for (const game of games) {
          const { message, success } = await doPOST(
            `/api/v1/db/update-stats/${game.id}`
          );
          enqueueSnackbar(message, {
            variant: success ? "success" : "error"
          });
        }
      }
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error"
      });
    }
  }

  async function updateLineCombinations() {
    try {
      const { message, success } = await doPOST(
        "/api/v1/db/update-line-combinations"
      );
      enqueueSnackbar(message, {
        variant: success ? "success" : "error"
      });
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error"
      });
    }
  }

  async function updatePowerPlayTimeframes() {
    try {
      // Validate input
      const trimmedInput = powerPlayInput.trim().toLowerCase();
      if (trimmedInput !== "all" && isNaN(Number(trimmedInput))) {
        enqueueSnackbar("Please enter a valid game ID or 'all'.", {
          variant: "error"
        });
        return;
      }

      // Construct the endpoint URL
      const endpoint =
        trimmedInput === "all"
          ? "/api/v1/db/powerPlayTimeFrame?gameId=all"
          : `/api/v1/db/powerPlayTimeFrame?gameId=${trimmedInput}`;

      const { message, success } = await doPOST(endpoint);
      enqueueSnackbar(message, {
        variant: success ? "success" : "error"
      });
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error"
      });
    }
  }

  async function updateShiftCharts() {
    try {
      // Validate input
      const trimmedInput = shiftChartsInput.trim().toLowerCase();
      if (trimmedInput !== "all" && isNaN(Number(trimmedInput))) {
        enqueueSnackbar("Please enter a valid game ID or 'all'.", {
          variant: "error"
        });
        return;
      }

      // Construct the endpoint URL
      const endpoint =
        trimmedInput === "all"
          ? "/api/v1/db/shift-charts?gameId=all"
          : `/api/v1/db/shift-charts?gameId=${trimmedInput}`;

      const { message, success } = await doPOST(endpoint);
      enqueueSnackbar(message, {
        variant: success ? "success" : "error"
      });
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error"
      });
    }
  }

  // Add this within your Page component
  async function updateNstTeamStats() {
    try {
      // Validate input
      const trimmedInput = nstTeamStatsInput.trim().toLowerCase();

      // Define allowed values
      const allowedValues = ["all", "all_season", "last_season"];

      // Check if input is a valid predefined option or a specific date
      if (
        !allowedValues.includes(trimmedInput) &&
        !/^\d{4}-\d{2}-\d{2}$/.test(trimmedInput)
      ) {
        enqueueSnackbar(
          "Please enter a valid option or date in YYYY-MM-DD format.",
          {
            variant: "error"
          }
        );
        return;
      }

      // Construct the endpoint URL with the date query parameter
      const endpoint = `/api/Teams/nst-team-stats?date=${encodeURIComponent(
        trimmedInput
      )}`;

      const { message, success } = await doPOST(endpoint);
      enqueueSnackbar(message, {
        variant: success ? "success" : "error"
      });
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error"
      });
    }
  }

  async function updateExpectedGoals() {
    try {
      const { message, success } = await doPOST(
        "/api/v1/db/update-expected-goals?date=all"
      );
      enqueueSnackbar(message, {
        variant: success ? "success" : "error"
      });
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error"
      });
    }
  }

  async function updateStandingsDetails() {
    try {
      // Convert input to lowercase, trim whitespace
      const trimmedInput = standingsDetailsInput.trim().toLowerCase();

      // Validate: allow 'all' or a YYYY-MM-DD date
      if (trimmedInput !== "all" && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedInput)) {
        enqueueSnackbar(
          "Please enter a valid date in YYYY-MM-DD format or 'all'.",
          {
            variant: "error"
          }
        );
        return;
      }

      // Construct the endpoint URL with the date query parameter
      const endpoint = `/api/v1/db/update-standings-details?date=${encodeURIComponent(
        trimmedInput
      )}`;

      // POST to the endpoint (adminOnly-protected)
      const { message, success } = await doPOST(endpoint);
      enqueueSnackbar(message, {
        variant: success ? "success" : "error"
      });
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error"
      });
    }
  }

  useEffect(() => {
    (async () => {
      const { count: numPlayers } = await supabase
        .from("players")
        .select("id", { count: "exact", head: true });
      setNumPlayers(numPlayers ?? 0);

      const { count: numSeasons } = await supabase
        .from("seasons")
        .select("id", { count: "exact", head: true });
      setNumSeasons(numSeasons ?? 0);

      const { count: numTeams } = await supabase
        .from("teams")
        .select("id", { count: "exact", head: true });
      setNumTeams(numTeams ?? 0);
    })();
  }, []);

  useEffect(() => {
    if (!season?.seasonId) return;
    (async () => {
      const { count: numGames } = await supabase
        .from("games")
        .select("id", { count: "exact", head: true })
        .eq("seasonId", season.seasonId);
      setNumGames(numGames ?? 0);

      const { data: finishedGames } = await supabase
        .from("games")
        .select("id,date")
        .eq("seasonId", season.seasonId)
        .lte("startTime", new Date().toISOString())
        .order("date", { ascending: false });
      setGames(finishedGames?.slice(0, 20) ?? []);
    })();
  }, [season?.seasonId]);

  return (
    <Container>
      <TextBanner text="Supabase Database" />

      <Grid container spacing={2} alignItems="stretch">
        {/* Players / Rosters Table Card */}
        <Grid xs={4}>
          <Card
            sx={{
              border: "5px solid #07aae2",
              borderRadius: "8px",
              height: "100%", // Ensures the card fills the Grid item's height
              display: "flex",
              flexDirection: "column",
              background: "linear-gradient(180deg, #202020 50%, #101010 80%)",
              color: "#fff"
            }}
          >
            <CardMedia
              sx={{ height: 140 }}
              image="/pictures/playersTable.png" // Local image path
              title="players table"
            />
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography gutterBottom variant="h5" component="div">
                PLAYERS / ROSTERS
              </Typography>
              <Typography variant="body2">
                The table contains the data for {numPlayers} players. The
                `players` and `rosters` tables will be updated simultaneously.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={updatePlayers}>
                Update
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Seasons Table Card */}
        <Grid xs={4}>
          <Card
            sx={{
              border: "5px solid #07aae2",
              borderRadius: "8px",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              background: "linear-gradient(180deg, #202020 50%, #101010 80%)",
              color: "#fff"
            }}
          >
            <CardMedia
              sx={{ height: 140 }}
              image="/pictures/seasonsTable.png" // Local image path
              title="seasons table"
            />
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography gutterBottom variant="h5" component="div">
                SEASONS
              </Typography>
              <Typography variant="body2">
                The table contains the data for {numSeasons} seasons. This card
                updates the `seasons` table.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={updateSeasons}>
                Update
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Teams Table Card */}
        <Grid xs={4}>
          <Card
            sx={{
              border: "5px solid #07aae2",
              borderRadius: "8px",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              background: "linear-gradient(180deg, #202020 50%, #101010 80%)",
              color: "#fff"
            }}
          >
            <CardMedia
              sx={{ height: 140 }}
              image="/pictures/teamsTable.png" // Local image path
              title="teams table"
            />
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography gutterBottom variant="h5" component="div">
                TEAMS
              </Typography>
              <Typography variant="body2">
                The table contains the data for {numTeams} teams. This card
                updates the `teams` & `team_season` tables.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={updateTeams}>
                Update
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Games Table Card */}
        <Grid xs={4}>
          <Card
            sx={{
              border: "5px solid #07aae2",
              borderRadius: "8px",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              background: "linear-gradient(180deg, #202020 50%, #101010 80%)",
              color: "#fff"
            }}
          >
            <CardMedia
              sx={{ height: 140 }}
              image="/pictures/gamesTable.png" // Local image path
              title="games table"
            />
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography gutterBottom variant="h5" component="div">
                GAMES
              </Typography>
              <Typography variant="body2">
                The table contains the data for {numGames} games in{" "}
                {season?.seasonId} season. This card updates the `games` tables.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={updateGames}>
                Update
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Stats Table Card */}
        <Grid xs={4}>
          <Card
            sx={{
              border: "5px solid #07aae2",
              borderRadius: "8px",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              background: "linear-gradient(180deg, #202020 50%, #101010 80%)",
              color: "#fff"
            }}
          >
            <CardMedia
              sx={{ height: 140 }}
              image="/pictures/statsTable.png" // Local image path
              title="stats table"
            />
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography gutterBottom variant="h5" component="div">
                STATS
              </Typography>
              <Typography variant="body2">
                Update stats for {games.length} games between{" "}
                {games.at(0)?.date} ~ {games.at(-1)?.date}
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={updateStats}>
                Update
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Power Play Timeframes Card */}
        <Grid xs={4}>
          <Card
            sx={{
              border: "5px solid #07aae2",
              borderRadius: "8px",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              background: "linear-gradient(180deg, #202020 50%, #101010 80%)",
              color: "#fff"
            }}
          >
            <CardMedia
              sx={{ height: 140 }}
              image="/pictures/ppTimeframes.png" // Local image path
              title="power play timeframes"
            />
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography gutterBottom variant="h5" component="div">
                PP TIMEFRAMES
              </Typography>
              <Typography variant="body2">
                Update the power play timeframes data for a specific game or all
                games.
              </Typography>
              {/* Optional Input Field for gameId */}
              <TextField
                label="Game ID or 'all'"
                variant="outlined"
                size="small"
                fullWidth
                margin="normal"
                value={powerPlayInput}
                onChange={(e) => setPowerPlayInput(e.target.value)}
                placeholder="Enter game ID or 'all'"
                sx={{
                  backgroundColor: "#202020",
                  border: "1px solid #07aae2",
                  borderRadius: "4px",
                  "& .css-1sumxir-MuiFormLabel-root-MuiInputLabel-root, .css-1n4twyu-MuiInputBase-input-MuiOutlinedInput-input":
                    {
                      color: "#07aae2",
                      fontWeight: "900",
                      textTransform: "uppercase",
                      backgroundColor: "#202020",
                      margin: "1px"
                    }
                }}
              />
            </CardContent>
            <CardActions>
              <Button size="small" onClick={updatePowerPlayTimeframes}>
                Update Power Play Timeframes
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Line Combinations Card */}
        <Grid xs={4}>
          <Card
            sx={{
              border: "5px solid #07aae2",
              borderRadius: "8px",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              background: "linear-gradient(180deg, #202020 50%, #101010 80%)",
              color: "#fff"
            }}
          >
            <CardMedia
              sx={{ height: 140 }}
              image="/pictures/linesTable.png" // Local image path
              title="line combinations"
            />
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography gutterBottom variant="h5" component="div">
                LINE COMBOS
              </Typography>
              <Typography variant="body2">
                Update the line combinations data for unprocessed games.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={updateLineCombinations}>
                Update
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Shift Charts Card */}
        <Grid xs={4}>
          <Card
            sx={{
              border: "5px solid #07aae2",
              borderRadius: "8px",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              background: "linear-gradient(180deg, #202020 50%, #101010 80%)",
              color: "#fff"
            }}
          >
            <CardMedia
              sx={{ height: 140 }}
              image="/pictures/shiftsTable.png" // Local image path
              title="shift charts"
            />
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography gutterBottom variant="h5" component="div">
                SHIFT CHARTS
              </Typography>
              <Typography variant="body2">
                Update shift charts data for a specific game or all games.
              </Typography>
              {/* Input Field for gameId */}
              <TextField
                label="Game ID or 'all'"
                variant="outlined"
                size="small"
                fullWidth
                margin="normal"
                value={shiftChartsInput}
                onChange={(e) => setShiftChartsInput(e.target.value)}
                placeholder="Enter game ID or 'all'"
                sx={{
                  backgroundColor: "#202020",
                  border: "1px solid #07aae2",
                  borderRadius: "4px",
                  "& .css-1sumxir-MuiFormLabel-root-MuiInputLabel-root, .css-1n4twyu-MuiInputBase-input-MuiOutlinedInput-input":
                    {
                      color: "#07aae2",
                      fontWeight: "900",
                      textTransform: "uppercase",
                      backgroundColor: "#202020",
                      margin: "1px"
                    }
                }}
              />
            </CardContent>
            <CardActions>
              <Button size="small" onClick={updateShiftCharts}>
                Update Shift Charts
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* NST Team Stats Card */}
        <Grid xs={4}>
          <Card
            sx={{
              border: "5px solid #07aae2",
              borderRadius: "8px",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              background: "linear-gradient(180deg, #202020 50%, #101010 80%)",
              color: "#fff"
            }}
          >
            <CardMedia
              sx={{ height: 140 }}
              image="/pictures/nstTables.png" // Replace with an appropriate image URL
              title="NST Team Stats"
            />
            <CardContent>
              <Typography gutterBottom variant="h5" component="div">
                NST Team Stats
              </Typography>
              <Typography variant="body2">
                Update NST team statistics based on date parameters. Choose to
                update all data, current season, last season, or a specific
                date.
              </Typography>
              {/* Input Field for Date Parameter */}
              <TextField
                label="Date Parameter"
                variant="outlined"
                size="small"
                fullWidth
                margin="normal"
                value={shiftChartsInput}
                onChange={(e) => setShiftChartsInput(e.target.value)}
                placeholder="Enter game ID or 'all'"
                sx={{
                  backgroundColor: "#202020",
                  border: "1px solid #07aae2",
                  borderRadius: "4px",
                  "& .css-1sumxir-MuiFormLabel-root-MuiInputLabel-root, .css-1n4twyu-MuiInputBase-input-MuiOutlinedInput-input":
                    {
                      color: "#07aae2",
                      fontWeight: "900",
                      textTransform: "uppercase",
                      backgroundColor: "#202020",
                      margin: "1px"
                    }
                }}
              />
            </CardContent>
            <CardActions>
              <Button size="small" onClick={updateNstTeamStats}>
                Update NST Team Stats
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Expected Goals Card */}
        <Grid xs={4}>
          <Card
            sx={{
              border: "5px solid #07aae2",
              borderRadius: "8px",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              background: "linear-gradient(180deg, #202020 50%, #101010 80%)",
              color: "#fff"
            }}
          >
            <CardMedia
              sx={{ height: 140 }}
              image="/pictures/expectedGoals.png" // Replace with an appropriate image URL or local path
              title="Expected Goals"
            />
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography gutterBottom variant="h5" component="div">
                EXPECTED GOALS
              </Typography>
              <Typography variant="body2">
                Update the expected goals calculations for all current games.
                This will analyze team performance metrics and update the
                `expected_goals` table in the database.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={updateExpectedGoals}>
                Update Expected Goals
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Standings Details Card */}
        <Grid xs={4}>
          <Card
            sx={{
              border: "5px solid #07aae2",
              borderRadius: "8px",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              background: "linear-gradient(180deg, #202020 50%, #101010 80%)",
              color: "#fff"
            }}
          >
            {/* (Optional) If you have a relevant image, replace the path below; or omit CardMedia. */}
            <CardMedia
              sx={{ height: 140 }}
              image="/pictures/fhfPlaceholder.png"
              title="standings details"
            />
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography gutterBottom variant="h5" component="div">
                STANDINGS DETAILS
              </Typography>
              <Typography variant="body2">
                Update NHL standings data for a single date (YYYY-MM-DD) or all
                dates (<strong>all</strong>) in the current season.
              </Typography>

              <TextField
                label="Date (YYYY-MM-DD) or 'all'"
                variant="outlined"
                size="small"
                fullWidth
                margin="normal"
                value={standingsDetailsInput}
                onChange={(e) => setStandingsDetailsInput(e.target.value)}
                placeholder="e.g. 2025-02-10 or 'all'"
                sx={{
                  backgroundColor: "#202020",
                  border: "1px solid #07aae2",
                  borderRadius: "4px",
                  "& .css-1sumxir-MuiFormLabel-root-MuiInputLabel-root, .css-1n4twyu-MuiInputBase-input-MuiOutlinedInput-input":
                    {
                      color: "#07aae2",
                      fontWeight: "900",
                      textTransform: "uppercase",
                      backgroundColor: "#202020",
                      margin: "1px"
                    }
                }}
              />
            </CardContent>
            <CardActions>
              <Button size="small" onClick={updateStandingsDetails}>
                Update Standings Details
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* New Card/Button to link to the CSV Upsert Page */}
        {isAdmin && ( // Only show this card/link if user is admin
          <Grid xs={12} md={4}>
            {" "}
            {/* Adjust grid size as needed */}
            <Card
              sx={{
                border: "5px solid #4caf50", // Different color for distinction
                borderRadius: "8px",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                background: "linear-gradient(180deg, #202020 50%, #101010 80%)",
                color: "#fff"
              }}
            >
              <CardMedia
                sx={{ height: 140 }}
                image="/pictures/csvImportIcon.png" // Add a relevant icon/image
                title="CSV Projection Importer"
              />
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography gutterBottom variant="h5" component="div">
                  CSV PROJECTION IMPORTER
                </Typography>
                <Typography variant="body2">
                  Upload CSV files, standardize player names and column metrics,
                  and upsert projections to new Supabase tables.
                </Typography>
              </CardContent>
              <CardActions>
                <Link href="/db/upsert-projections" passHref legacyBehavior>
                  <Button
                    component="a"
                    size="small"
                    variant="contained"
                    color="success"
                  >
                    Go to Importer
                  </Button>
                </Link>
              </CardActions>
            </Card>
          </Grid>
        )}
      </Grid>

      <Button
        onClick={async () => {
          console.log("click clll");
          const { data } = await supabase.from("goaliesGameStats").select("*");
          console.log(data);
        }}
      >
        Snackbar
      </Button>
    </Container>
  );
}
