CREATE TABLE IF NOT EXISTS launches (
    -- Identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ll2_id UUID NOT NULL UNIQUE,

    -- Launch information
    name TEXT NOT NULL,
    slug TEXT,
    launch_designator TEXT,
    net TIMESTAMPTZ NOT NULL,
    net_precision TEXT,
    window_start TIMESTAMPTZ,
    window_end TIMESTAMPTZ,

    -- Launch status
    status_id INTEGER,
    status_name TEXT,
    failreason TEXT,

    -- Agency, rocket and mission
    agency_name TEXT,
    rocket_name TEXT,
    mission_name TEXT,
    mission_type TEXT,
    mission_description TEXT,
    orbit_name TEXT,

    -- Location and media
    pad_name TEXT,
    location_name TEXT,
    country_name TEXT,
    image_url TEXT,
    image_credit TEXT,

    -- Synchronization metadata
    source_updated_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Complete original LL2 response
    raw_data JSONB NOT NULL
);

-- Index for launch-date filtering and sorting
CREATE INDEX IF NOT EXISTS idx_launches_net
ON launches (net);
