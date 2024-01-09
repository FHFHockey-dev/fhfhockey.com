import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Snackbar,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2"; // Grid version 2

import { TextBanner } from "components/Banner/Banner";
import Container from "components/Layout/Container";
import supabase, { doPOST } from "lib/supabase";

export default function Page() {
  const [open, setOpen] = useState(false);

  const [numPlayers, setNumPlayers] = useState(0);
  const [numSeasons, setNumSeasons] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // snackbar
  const handleClose = (
    event: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") {
      return;
    }

    setOpen(false);
  };

  async function updatePlayers() {
    try {
      await doPOST("/api/v1/db/update-players");
      setOpen(true);
      setError(null);
    } catch (e: any) {
      console.error(e.message);
      setError(e.message);
    }
  }

  async function updateSeasons() {
    try {
      await doPOST("/api/v1/db/update-seasons");
      setOpen(true);
      setError(null);
    } catch (e: any) {
      console.error(e.message);
      setError(e.message);
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
    })();
  }, []);

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
                The table contains the data for {numPlayers} players.
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
                The table contains the data for {numSeasons} seasons.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={updateSeasons}>
                Update
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
      <Snackbar open={open} autoHideDuration={6000} onClose={handleClose}>
        {error ? (
          <Alert severity="error">Unable to update the table. {error}</Alert>
        ) : (
          <Alert
            onClose={handleClose}
            severity="success"
            sx={{ width: "100%" }}
          >
            {`Successfully updated the table!`}
          </Alert>
        )}
      </Snackbar>
    </Container>
  );
}
