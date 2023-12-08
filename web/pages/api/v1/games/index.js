// Next.js API route at 

import axios from 'axios';

export default async function handler(req, res) {
  const { date } = req.query;

  try {
    const response = await axios.get(`https://api-web.nhle.com/v1/schedule/${date}`);
    res.status(200).json(response.data.gameWeek[0].games || []);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching games' });
  }
}
