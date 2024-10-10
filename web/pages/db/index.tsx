import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Typography,
  TextField,
} from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2"; // Grid version 2

import { TextBanner } from "components/Banner/Banner";
import Container from "components/Layout/Container";
import supabase, { doPOST } from "lib/supabase";
import { useSnackbar } from "notistack";
import useCurrentSeason from "hooks/useCurrentSeason";

export default function Page() {
  const { enqueueSnackbar } = useSnackbar();

  const [numPlayers, setNumPlayers] = useState(0);
  const [numSeasons, setNumSeasons] = useState(0);
  const [numTeams, setNumTeams] = useState(0);
  const [numGames, setNumGames] = useState(0);
  const [games, setGames] = useState<{ id: number; date: string }[]>([]);
  const [powerPlayInput, setPowerPlayInput] = useState<string>("all"); // State for gameId input
  const [shiftChartsInput, setShiftChartsInput] = useState<string>("all"); // State for Shift Charts input

  const season = useCurrentSeason();
  console.log(season);

  async function updatePlayers() {
    try {
      const { message, success } = await doPOST("/api/v1/db/update-players");
      enqueueSnackbar(message, {
        variant: success ? "success" : "error",
      });
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error",
      });
    }
  }

  async function updateSeasons() {
    try {
      const { message, success } = await doPOST("/api/v1/db/update-seasons");
      enqueueSnackbar(message, {
        variant: success ? "success" : "error",
      });
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error",
      });
    }
  }

  async function updateTeams() {
    try {
      const { message, success } = await doPOST("/api/v1/db/update-teams");
      enqueueSnackbar(message, {
        variant: success ? "success" : "error",
      });
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error",
      });
    }
  }

  async function updateGames() {
    try {
      const { message, success } = await doPOST("/api/v1/db/update-games");
      enqueueSnackbar(message, {
        variant: success ? "success" : "error",
      });
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error",
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
            variant: success ? "success" : "error",
          });
        }
      }
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error",
      });
    }
  }

  async function updateLineCombinations() {
    try {
      const { message, success } = await doPOST(
        "/api/v1/db/update-line-combinations"
      );
      enqueueSnackbar(message, {
        variant: success ? "success" : "error",
      });
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error",
      });
    }
  }

  async function updatePowerPlayTimeframes() {
    try {
      // Validate input
      const trimmedInput = powerPlayInput.trim().toLowerCase();
      if (trimmedInput !== "all" && isNaN(Number(trimmedInput))) {
        enqueueSnackbar("Please enter a valid game ID or 'all'.", {
          variant: "error",
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
        variant: success ? "success" : "error",
      });
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error",
      });
    }
  }

  async function updateShiftCharts() {
    try {
      // Validate input
      const trimmedInput = shiftChartsInput.trim().toLowerCase();
      if (trimmedInput !== "all" && isNaN(Number(trimmedInput))) {
        enqueueSnackbar("Please enter a valid game ID or 'all'.", {
          variant: "error",
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
        variant: success ? "success" : "error",
      });
    } catch (e: any) {
      console.error(e.message);
      enqueueSnackbar(e.message, {
        variant: "error",
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
        .order("date", { ascending: true });
      setGames(finishedGames?.slice(10, 30) ?? []);
    })();
  }, [season?.seasonId]);

  return (
    <Container>
      <TextBanner text="Supabase Database" />

      <Grid container spacing={2}>
        <Grid xs={4}>
          <Card>
            <CardMedia
              sx={{ height: 140 }}
              image="https://img.bleacherreport.net/img/slides/photos/004/465/001/2073e9622e4d04f0146efc1c69d1f539_crop_exact.jpg?w=2975&h=2048&q=85"
              title="players table"
            />
            <CardContent>
              <Typography gutterBottom variant="h5" component="div">
                players
              </Typography>
              <Typography variant="body2" color="text.secondary">
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

        <Grid xs={4}>
          <Card>
            <CardMedia
              sx={{ height: 140 }}
              image="https://media.nhl.com/site/asset/public/images/2023/09/Season-Preview_Media-21110824.png"
              title="players table"
            />
            <CardContent>
              <Typography gutterBottom variant="h5" component="div">
                seasons
              </Typography>
              <Typography variant="body2" color="text.secondary">
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

        <Grid xs={4}>
          <Card>
            <CardMedia
              sx={{ height: 140 }}
              image="https://media.d3.nhle.com/image/private/t_ratio16_9-size20/prd/e0zxtwtpk50zvxkoovim"
              title="teams"
            />
            <CardContent>
              <Typography gutterBottom variant="h5" component="div">
                teams
              </Typography>
              <Typography variant="body2" color="text.secondary">
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

        <Grid xs={4}>
          <Card>
            <CardMedia
              sx={{ height: 140 }}
              image="https://media.d3.nhle.com/image/private/t_ratio16_9-size20/prd/e0zxtwtpk50zvxkoovim"
              title="teams"
            />
            <CardContent>
              <Typography gutterBottom variant="h5" component="div">
                games
              </Typography>
              <Typography variant="body2" color="text.secondary">
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

        <Grid xs={4}>
          <Card>
            <CardMedia
              sx={{ height: 140 }}
              image="https://media.d3.nhle.com/image/private/t_ratio16_9-size20/prd/e0zxtwtpk50zvxkoovim"
              title="teams"
            />
            <CardContent>
              <Typography gutterBottom variant="h5" component="div">
                stats
              </Typography>
              <Typography variant="body2" color="text.secondary">
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

        {/* New Card for Power Play Timeframes */}
        <Grid xs={4}>
          <Card>
            <CardMedia
              sx={{ height: 140 }}
              image="https://example.com/powerplay_image.jpg" // Replace with an appropriate image URL
              title="power play timeframes"
            />
            <CardContent>
              <Typography gutterBottom variant="h5" component="div">
                Power Play Timeframes
              </Typography>
              <Typography variant="body2" color="text.secondary">
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
              />
            </CardContent>
            <CardActions>
              <Button size="small" onClick={updatePowerPlayTimeframes}>
                Update Power Play Timeframes
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* New Card for Line Combinations */}
        <Grid xs={4}>
          <Card>
            <CardMedia
              sx={{ height: 140 }}
              image="https://kickly.net/wp-content/uploads/2022/09/Hockey-Starting-Lineup-Editable-Graphic-V.png"
              title="line combinations"
            />
            <CardContent>
              <Typography gutterBottom variant="h5" component="div">
                line combinations
              </Typography>
              <Typography variant="body2" color="text.secondary">
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

        {/* New Card for Shift Charts */}
        <Grid xs={4}>
          <Card>
            <CardMedia
              sx={{ height: 140 }}
              image="https://www.naturalstattrick.com/shiftcharts/games/20242025/20242025-10058-shiftchart.png" // Replace with an appropriate image URL
              title="shift charts"
            />
            <CardContent>
              <Typography gutterBottom variant="h5" component="div">
                Shift Charts
              </Typography>
              <Typography variant="body2" color="text.secondary">
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
              />
            </CardContent>
            <CardActions>
              <Button size="small" onClick={updateShiftCharts}>
                Update Shift Charts
              </Button>
            </CardActions>
          </Card>
        </Grid>
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
