// Next.js API route at
export default async function handler(req, res) {
  const { date } = req.query;

  try {
    const response = await fetch(
      `https://api-web.nhle.com/v1/schedule/${date}`
    ).then((res) => res.json());
    res.status(200).json(response.gameWeek[0].games || []);
  } catch (error) {
    res.status(500).json({ error: "Error fetching games" });
  }
}
