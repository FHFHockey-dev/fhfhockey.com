import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Typography,
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
  const season = useCurrentSeason();

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
      </Grid>

      <Button
        onClick={() => {
          enqueueSnackbar("a simple snackbar", {
            variant: "success",
          });
        }}
      >
        Snackbar
      </Button>
    </Container>
  );
}
