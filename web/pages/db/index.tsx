import { useEffect, useState } from "react";
import { Button } from "@mui/material";
import { TextBanner } from "components/Banner/Banner";
import Container from "components/Layout/Container";
import supabase from "lib/supabase";

function updatePlayers() {
  supabase.auth.user();
  fetch("/api/db/update-players", {
    method: "POST",
    headers: {
      Authorization: `Bearer x`,
    },
  });
}

export default function Page() {
  const [numPlayers, setNumPlayers] = useState(0);
  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from("players")
        .select("id", { count: "exact", head: true });
      setNumPlayers(count ?? 0);
    })();
  }, []);

  return (
    <Container>
      <TextBanner text="Supabase Database" />
      num players: {numPlayers}
      <Button variant="contained" color="info" onClick={updatePlayers}>
        Update `players` table
      </Button>
    </Container>
  );
}
