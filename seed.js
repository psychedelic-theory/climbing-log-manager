// assets/js/seed.js
function id() {
    return crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random().toString(16).slice(2);
}

// Mix of gym/outdoor, boulder/rope, complete/incomplete.
// Boulders use V-scale; roped climbs use YDS.

export const SEED_LOGS = [
    // ----- Gym Bouldering -----
    { id: id(), date: "2026-01-03", environment: "gym", location: "BlocHaven", routeName: "Slab Warm-Up", climbType: "boulder", gradeSystem: "V", grade: "V0", progress: "complete" },
    { id: id(), date: "2026-01-04", environment: "gym", location: "BlocHaven", routeName: "Compression Cube", climbType: "boulder", gradeSystem: "V", grade: "V2", progress: "complete" },
    { id: id(), date: "2026-01-05", environment: "gym", location: "BlocHaven", routeName: "Dyno Lane", climbType: "boulder", gradeSystem: "V", grade: "V3", progress: "incomplete" },
    { id: id(), date: "2026-01-07", environment: "gym", location: "The Climbing Collective", routeName: "Pinch Patrol", climbType: "boulder", gradeSystem: "V", grade: "V4", progress: "complete" },
    { id: id(), date: "2026-01-09", environment: "gym", location: "The Climbing Collective", routeName: "Overhang Habit", climbType: "boulder", gradeSystem: "V", grade: "V5", progress: "incomplete" },

    // ----- Gym Top Rope / Sport -----
    { id: id(), date: "2026-01-03", environment: "gym", location: "Stone Summit", routeName: "Green Ladder", climbType: "top-rope", gradeSystem: "YDS", grade: "5.7", progress: "complete" },
    { id: id(), date: "2026-01-06", environment: "gym", location: "Stone Summit", routeName: "Sidepull City", climbType: "top-rope", gradeSystem: "YDS", grade: "5.9", progress: "complete" },
    { id: id(), date: "2026-01-06", environment: "gym", location: "Stone Summit", routeName: "Red Arete", climbType: "top-rope", gradeSystem: "YDS", grade: "5.10a", progress: "incomplete" },
    { id: id(), date: "2026-01-10", environment: "gym", location: "Central Rock Gym", routeName: "Volume Season", climbType: "sport", gradeSystem: "YDS", grade: "5.10b", progress: "complete" },
    { id: id(), date: "2026-01-12", environment: "gym", location: "Central Rock Gym", routeName: "Crux Therapy", climbType: "sport", gradeSystem: "YDS", grade: "5.11a", progress: "incomplete" },

    // ----- Outdoor Bouldering -----
    { id: id(), date: "2025-11-02", environment: "outdoor", location: "Rumney (Boulders)", routeName: "Pocket Warm-Up", climbType: "boulder", gradeSystem: "V", grade: "V1", progress: "complete" },
    { id: id(), date: "2025-11-02", environment: "outdoor", location: "Rumney (Boulders)", routeName: "Slopey Mantle", climbType: "boulder", gradeSystem: "V", grade: "V3", progress: "incomplete" },
    { id: id(), date: "2025-12-08", environment: "outdoor", location: "Boone (Roadside)", routeName: "Quartz Traverse", climbType: "boulder", gradeSystem: "V", grade: "V2", progress: "complete" },
    { id: id(), date: "2025-12-08", environment: "outdoor", location: "Boone (Roadside)", routeName: "Highball Line", climbType: "boulder", gradeSystem: "V", grade: "V4", progress: "incomplete" },
    { id: id(), date: "2025-10-19", environment: "outdoor", location: "Stone Fort (LRC)", routeName: "Hueco Dreams", climbType: "boulder", gradeSystem: "V", grade: "V5", progress: "complete" },

    // ----- Outdoor Top Rope -----
    { id: id(), date: "2025-09-14", environment: "outdoor", location: "Looking Glass Rock", routeName: "Sunset Slab", climbType: "top-rope", gradeSystem: "YDS", grade: "5.6", progress: "complete" },
    { id: id(), date: "2025-09-14", environment: "outdoor", location: "Looking Glass Rock", routeName: "Granite Groove", climbType: "top-rope", gradeSystem: "YDS", grade: "5.8", progress: "complete" },
    { id: id(), date: "2025-10-05", environment: "outdoor", location: "Pilot Mountain", routeName: "Arete Practice", climbType: "top-rope", gradeSystem: "YDS", grade: "5.9", progress: "incomplete" },
    { id: id(), date: "2025-10-05", environment: "outdoor", location: "Pilot Mountain", routeName: "Edge Finder", climbType: "top-rope", gradeSystem: "YDS", grade: "5.10a", progress: "complete" },
    { id: id(), date: "2025-08-24", environment: "outdoor", location: "Table Rock", routeName: "Beginner Corner", climbType: "top-rope", gradeSystem: "YDS", grade: "5.7", progress: "complete" },

    // ----- Outdoor Sport / Lead -----
    { id: id(), date: "2025-11-16", environment: "outdoor", location: "Rumney (Main Cliff)", routeName: "Bolt Line", climbType: "sport", gradeSystem: "YDS", grade: "5.10c", progress: "complete" },
    { id: id(), date: "2025-11-16", environment: "outdoor", location: "Rumney (Main Cliff)", routeName: "Crimp Cruise", climbType: "sport", gradeSystem: "YDS", grade: "5.11a", progress: "incomplete" },
    { id: id(), date: "2025-10-27", environment: "outdoor", location: "Tennessee Wall", routeName: "Pocket Rocket", climbType: "sport", gradeSystem: "YDS", grade: "5.10b", progress: "complete" },
    { id: id(), date: "2025-10-27", environment: "outdoor", location: "Tennessee Wall", routeName: "Pump Ticket", climbType: "sport", gradeSystem: "YDS", grade: "5.11b", progress: "incomplete" },
    { id: id(), date: "2025-09-29", environment: "outdoor", location: "Hidden Valley", routeName: "Face Value", climbType: "sport", gradeSystem: "YDS", grade: "5.9", progress: "complete" },

    // ----- Outdoor Trad -----
    { id: id(), date: "2025-09-21", environment: "outdoor", location: "Linville Gorge", routeName: "Gear Up", climbType: "trad", gradeSystem: "YDS", grade: "5.7", progress: "incomplete" },
    { id: id(), date: "2025-09-21", environment: "outdoor", location: "Linville Gorge", routeName: "Hand Jam Practice", climbType: "trad", gradeSystem: "YDS", grade: "5.8", progress: "complete" },
    { id: id(), date: "2025-10-12", environment: "outdoor", location: "Looking Glass Rock", routeName: "Crack & Smile", climbType: "trad", gradeSystem: "YDS", grade: "5.9", progress: "complete" },
    { id: id(), date: "2025-10-12", environment: "outdoor", location: "Looking Glass Rock", routeName: "Nervous Nuts", climbType: "trad", gradeSystem: "YDS", grade: "5.10a", progress: "incomplete" },
    { id: id(), date: "2025-08-31", environment: "outdoor", location: "Moore's Wall", routeName: "Friction Faith", climbType: "trad", gradeSystem: "YDS", grade: "5.6", progress: "complete" },
];
