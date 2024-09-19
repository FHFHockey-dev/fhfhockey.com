// lib/supabase/utils/dataFetching.js

const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Supabase URL or Public Key is missing in the environment variables."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Fetches all records from a Supabase table with pagination.
 * @param {string} tableName - The name of the table to fetch data from.
 * @param {object} options - Additional options like order.
 * @returns {Promise<Array>} - Array of all records.
 */
async function fetchAllData(tableName, options = {}) {
  const pageSize = 1000;
  let from = 0;
  let to = pageSize - 1;
  let allData = [];
  let moreData = true;

  while (moreData) {
    let query = supabase.from(tableName).select("*").range(from, to);

    // Apply ordering if specified
    if (options.order) {
      const { column, ascending } = options.order;
      query = query.order(column, { ascending });
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(
        `Error fetching data from ${tableName}: ${error.message}`
      );
    }

    if (data.length > 0) {
      allData = allData.concat(data);
      from += pageSize;
      to += pageSize;
    } else {
      moreData = false;
    }
  }

  return allData;
}

/**
 * Fetches yearly stats from 'sko_skater_years' table with pagination.
 * @returns {Promise<Array>} - Array of yearly stats records.
 */
async function fetchYearlyData() {
  return await fetchAllData("sko_skater_years", {
    order: { column: "season", ascending: true },
  });
}

/**
 * Fetches game stats from 'sko_skater_stats' table with pagination.
 * @returns {Promise<Array>} - Array of game stats records.
 */
async function fetchGameStats() {
  return await fetchAllData("sko_skater_stats", {
    order: { column: "date", ascending: true },
  });
}

module.exports = {
  fetchYearlyData,
  fetchGameStats,
};
