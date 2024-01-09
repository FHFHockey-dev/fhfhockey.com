import { useEffect, useState } from "react";
import { Button } from "@mui/material";
import { TextBanner } from "components/Banner/Banner";
import Container from "components/Layout/Container";
import supabase, { doPOST } from "lib/supabase";

async function updatePlayers() {
  try {
    console.log("update players!!!");
    const result = await doPOST("/api/v1/db/update-players", {
      info: "hahahha",
    });

    console.log({ result });
  } catch (e: any) {
    console.error(e.message);
  }
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
      <div />
      <Button variant="contained" onClick={updatePlayers}>
        Test
      </Button>
    </Container>
  );
}
