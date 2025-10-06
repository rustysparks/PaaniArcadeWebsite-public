import { fetchRacesForDate } from 'public/raceDataService.js';

$w.onReady(() => {
    console.log("🚀 DownloadRaceVideo onReady");
    initDownloadRaceLogic();
});

export function initDownloadRaceLogic() {
    console.log("🚀 initDownloadRaceLogic started");

    const today = new Date().toISOString().split("T")[0];
    console.log("📅 Loading races for:", today);

    // Hide all collapsible containers by default
    $w("#DataStatusBox").collapse();
    $w("#listBox").collapse();
    $w("#NoResultsFoundBox").collapse();
    $w("#loadmoreBox").collapse();

    // Make sure static elements are shown
    $w("#SelectRaceDate").show();
    $w("#datePicker").show();

    // Fetch races for today
    fetchRacesForDate(today).then(result => {
        console.log("📦 fetch result:", result);

        if (result.status === "success" && result.races.length > 0) {
            $w("#DataStatusBox").expand();
            $w("#LoadingStatus").text = `Found ${result.races.length} races.`;
            $w("#listBox").expand();
            $w("#raceRepeater").data = result.races;
            $w("#loadmoreBox").expand();
            $w("#NoResultsFoundBox").collapse();

        } else if (result.status === "empty") {
            $w("#DataStatusBox").expand();
            $w("#LoadingStatus").text = "No races found for this date.";
            $w("#NoResultsFoundBox").expand();
            $w("#listBox").collapse();
            $w("#loadmoreBox").collapse();

        } else {
            $w("#DataStatusBox").expand();
            $w("#LoadingStatus").text = "Error loading race data.";
            $w("#NoResultsFoundBox").expand();
            $w("#listBox").collapse();
            $w("#loadmoreBox").collapse();
        }
    }).catch(error => {
        console.error("❌ Error loading race data:", error);
        $w("#DataStatusBox").expand();
        $w("#LoadingStatus").text = "Error fetching race data.";
        $w("#NoResultsFoundBox").expand();
    });

    // Repeater item handler
    $w("#raceRepeater").onItemReady(($item, itemData) => {
        $item("#raceText").text = itemData.name || "Unnamed Race";
        $item("#linkButton").label = "Open Folder";
        $item("#linkButton").link = itemData.folderUrl || "#";
    });

    // Load more button
    $w("#btnMoreResults").onClick(() => {
        console.log("🔽 Load more clicked");
        // Placeholder: implement pagination logic if needed
    });
}
