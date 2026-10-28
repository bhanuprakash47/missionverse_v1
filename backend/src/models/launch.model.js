
const { pool } = require("../config/db.js");

// Only these columns are allowed in our SQL queries.
const LAUNCH_COLUMNS = [
    "ll2_id",
    "name",
    "slug",
    "launch_designator",
    "net",
    "net_precision",
    "window_start",
    "window_end",
    "status_id",
    "status_name",
    "failreason",
    "agency_name",
    "rocket_name",
    "mission_name",
    "mission_type",
    "mission_description",
    "orbit_name",
    "pad_name",
    "location_name",
    "country_name",
    "image_url",
    "image_credit",
    "source_updated_at",
    "raw_data"
];

// Save or update one launch.
const saveLaunch = async (launch) => {

    // Validate input.
    if (
        !launch ||
        typeof launch !== "object" ||
        Array.isArray(launch)
    ) {
        throw new TypeError("Invalid launch object");
    }

    // Ensure required values exist.
    const requiredFields = [
        "ll2_id",
        "name",
        "net",
        "raw_data"
    ];

    for (const field of requiredFields) {
        if (
            launch[field] == null ||
            launch[field] === ""
        ) {
            throw new Error(`Missing required field: ${field}`);
        }
    }

    // Generate SQL placeholders: $1, $2, $3...
    const placeholders = LAUNCH_COLUMNS
        .map((_, index) => `$${index + 1}`)
        .join(", ");

    // Prepare values in the same order as columns.
    const values = LAUNCH_COLUMNS.map((column) => {
        if (column === "raw_data") {
            return JSON.stringify(launch.raw_data);
        }

        return launch[column] ?? null;
    });

    // Generate update assignments.
    // Never update the external LL2 identifier.
    const updateColumns = LAUNCH_COLUMNS.filter(
        (column) => column !== "ll2_id"
    );

    const updateAssignments = updateColumns
        .map((column) => {
            return `${column} = EXCLUDED.${column}`;
        })
        .join(",\n");

    // PostgreSQL UPSERT query.
    const query = `
        INSERT INTO launches (
            ${LAUNCH_COLUMNS.join(", ")},
            synced_at
        )
        VALUES (
            ${placeholders},
            NOW()
        )

        ON CONFLICT (ll2_id)
        DO UPDATE SET
            ${updateAssignments},
            synced_at = NOW()

        RETURNING
            id,
            ll2_id,
            name,
            status_name,
            synced_at;
    `;

    // Execute the parameterized query.
    const result = await pool.query(query, values);

    // Return the inserted or updated record.
    return result.rows[0];
};

module.exports = {
    saveLaunch
};
