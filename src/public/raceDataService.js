// raceDataService.js

export async function fetchRacesForDate(dateStr) {
  const endpoint = `https://script.google.com/macros/s/AKfycbzR5LqPnETUx5gpyQDhva44K9UY5pw2HqkkugotxnGqjlqsKZSi2ZtnvRNeUAyTgTgE/exec?date=${dateStr}`;

  console.log("📅 Fetching races from:", endpoint);

  try {
    const response = await fetch(endpoint);
    
    if (!response.ok) {
      console.error("❌ Network response was not ok:", response.status);
      return {
        status: "error",
        races: [],
        message: `Network error: ${response.status}`
      };
    }

    const data = await response.json();
    console.log("📦 fetch result:", data);
    return data;

  } catch (err) {
    console.error("❌ Fetch failed:", err);
    return {
      status: "error",
      races: [],
      message: err.message
    };
  }
}
