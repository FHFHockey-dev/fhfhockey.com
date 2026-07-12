// Next.js API route at
export default async function handler(req, res) {
  const { date } = req.query;
  const requestedDate = Array.isArray(date) ? date[0] : date;

  if (!requestedDate) {
    res.status(400).json({ error: "Missing required date parameter" });
    return;
  }

  try {
    const response = await fetch(
      `https://api-web.nhle.com/v1/schedule/${requestedDate}`
    );

    if (!response.ok) {
      res.status(response.status).json({ error: "Error fetching games" });
      return;
    }

    const schedule = await response.json();
    const gameWeek = Array.isArray(schedule?.gameWeek) ? schedule.gameWeek : [];
    const dateSchedule =
      gameWeek.find((entry) => entry?.date === requestedDate) || gameWeek[0];

    res.status(200).json(Array.isArray(dateSchedule?.games) ? dateSchedule.games : []);
  } catch (error) {
    res.status(502).json({ error: "Error fetching games" });
  }
}
