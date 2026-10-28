
require("dotenv").config();

const LL2_BASE_URL = process.env.LL2_BASE_URL;

// Check whether a value is a plain JSON object
const isObject = (value) => {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
};

// Safely access nested properties
const getPath = (obj, path) => {
    let current = obj;

    for (let i = 0; i < path.length; i++) {
        if (current == null) return null;

        if (!isObject(current)) {
            throw new TypeError(
                `Expected object at ${path.slice(0, i).join(".")}`
            );
        }

        current = current[path[i]];
    }

    return current ?? null;
};

// Extract and validate text fields
const getText = (obj, path, required = false) => {
    const value = getPath(obj, path);
    const field = path.join(".");

    if (value == null || value === "") {
        if (required) {
            throw new Error(`Required field missing: ${field}`);
        }

        return null;
    }

    if (typeof value !== "string") {
        throw new TypeError(`Invalid text field: ${field}`);
    }

    if (!value.trim()) {
        if (required) {
            throw new Error(`Required field is empty: ${field}`);
        }

        return null;
    }

    return value;
};

// Extract and validate integer fields
const getInteger = (obj, path) => {
    const value = getPath(obj, path);

    if (value == null) return null;

    if (!Number.isSafeInteger(value)) {
        throw new TypeError(
            `Invalid integer field: ${path.join(".")}`
        );
    }

    return value;
};

// Extract and validate timestamps
const getTimestamp = (obj, path, required = false) => {
    const value = getText(obj, path, required);

    if (value == null) return null;

    const validISO =
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i;

    if (
        !validISO.test(value) ||
        !Number.isFinite(Date.parse(value))
    ) {
        throw new TypeError(
            `Invalid timestamp: ${path.join(".")}`
        );
    }

    return value;
};

// Convert a detailed LL2 launch into database-ready data
const getFormattedObj = (launch) => {
    if (!isObject(launch)) {
        throw new TypeError("Launch must be an object");
    }

    const ll2Id = getText(launch, ["id"], true);

    const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(ll2Id)) {
        throw new Error("Invalid LL2 launch UUID");
    }

    return {
        // External identifier
        ll2_id: ll2Id,

        // Launch information
        name: getText(launch, ["name"], true),
        slug: getText(launch, ["slug"]),
        launch_designator: getText(
            launch, ["launch_designator"]
        ),

        net: getTimestamp(launch, ["net"], true),
        net_precision: getText(
            launch, ["net_precision", "name"]
        ),

        window_start: getTimestamp(
            launch, ["window_start"]
        ),
        window_end: getTimestamp(
            launch, ["window_end"]
        ),

        // Launch status
        status_id: getInteger(
            launch, ["status", "id"]
        ),
        status_name: getText(
            launch, ["status", "name"]
        ),
        failreason: getText(
            launch, ["failreason"]
        ),

        // Agency
        agency_name: getText(
            launch, ["launch_service_provider", "name"]
        ),

        // Rocket
        rocket_name: getText(
            launch, ["rocket", "configuration", "full_name"]
        ),

        // Mission
        mission_name: getText(
            launch, ["mission", "name"]
        ),
        mission_type: getText(
            launch, ["mission", "type"]
        ),
        mission_description: getText(
            launch, ["mission", "description"]
        ),
        orbit_name: getText(
            launch, ["mission", "orbit", "name"]
        ),

        // Launch location
        pad_name: getText(
            launch, ["pad", "name"]
        ),
        location_name: getText(
            launch, ["pad", "location", "name"]
        ),
        country_name: getText(
            launch, ["pad", "country", "name"]
        ),

        // Media
        image_url: getText(
            launch, ["image", "image_url"]
        ),
        image_credit: getText(
            launch, ["image", "credit"]
        ),

        // LL2 source update timestamp
        source_updated_at: getTimestamp(
            launch, ["last_updated"]
        ),

        // Preserve original detailed response
        raw_data: launch
    };
};

// Fetch and transform launch records
const fetchLaunches = async (limit = 2, offset = 0) => {
    if (!LL2_BASE_URL) {
        throw new Error("LL2_BASE_URL is missing");
    }

    if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100
    ) {
        throw new RangeError(
            "Limit must be between 1 and 100"
        );
    }

    if (
        !Number.isSafeInteger(offset) ||
        offset < 0
    ) {
        throw new RangeError(
            "Offset must be a non-negative integer"
        );
    }

    try {
        console.log("Started fetching launches...");

        const baseURL = LL2_BASE_URL.replace(/\/+$/, "");

        const url = new URL(`${baseURL}/launches/`);

        url.searchParams.set("mode", "detailed");
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("offset", String(offset));

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json"
            },
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            throw new Error(
                `LL2 API request failed: HTTP ${response.status}`
            );
        }

        const data = await response.json();

        if (
            !isObject(data) ||
            !Array.isArray(data.results) ||
            !Number.isInteger(data.count)
        ) {
            throw new Error(
                "Invalid LL2 API response structure"
            );
        }

        const formattedLaunches = [];
        const errors = [];

        // Validate each launch independently
        for (const launch of data.results) {
            try {
                const formatted = getFormattedObj(launch);
                formattedLaunches.push(formatted);
            } catch (err) {
                const failure = {
                    ll2_id: launch?.id ?? null,
                    reason: err.message
                };

                errors.push(failure);

                console.warn(
                    `Skipping invalid launch ${failure.ll2_id}: ${failure.reason}`
                );
            }
        }

        console.log(
            `Fetched: ${data.results.length}, ` +
            `Valid: ${formattedLaunches.length}, ` +
            `Invalid: ${errors.length}`
        );

        return {
            count: data.count,
            next: data.next ?? null,
            previous: data.previous ?? null,
            results: formattedLaunches,
            skipped: errors.length,
            errors
        };

    } catch (err) {
        console.error(
            "Error fetching LL2 launches:",
            err.message
        );

        throw err;
    }
};

module.exports = {
    fetchLaunches,
    getFormattedObj
};

// Execute only when running this file directly
if (require.main === module) {
    fetchLaunches()
        .then((data) => {
            console.log("Total available:", data.count);
            console.log("Valid launches:", data.results.length);
            console.log("Skipped launches:", data.skipped);
            console.log("Next page:", data.next);

            for (const launch of data.results) {
                const { raw_data, ...fields } = launch;

                console.dir(fields, {
                    depth: null
                });
            }
        })
        .catch(() => {
            process.exitCode = 1;
        });
}
