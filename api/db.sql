CREATE DATABASE xssaas;
USE xssaas;

-- User accounts, both for delivering and recieving jobs
CREATE TABLE Users (
    userId BIGINT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    passwordHash CHAR(128) NOT NULL,
    creationTs BIGINT UNSIGNED NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL
);

-- Login tokens
-- OAUTH2 Bearer tokens
CREATE TABLE AuthTokens (
    authToken VARCHAR(64) PRIMARY KEY,
    userId BIGINT REFERENCES Users,
    authTokenExpiration DATETIME NOT NULL
);

-- Functions are a classification of similar tasks which use the same scripts
CREATE TABLE Functions (
    functionId CHAR(36) PRIMARY KEY,
    userId BIGINT REFERENCES Users,                         -- user who created this function
    name VARCHAR(64) NOT NULL,
    about VARCHAR(255) DEFAULT NULL,
    creationTs BIGINT UNSIGNED NOT NULL,

    -- required to invoke the function
    invokeToken CHAR(32) UNIQUE,

    -- Distribution Policy
    --  some use cases want more spread out requests
    --  other use cases it's better to have same worker perform all requests
    preventReuse BOOLEAN DEFAULT 0,

    optSpec ENUM('CPU', 'NET', 'BALANCED') default 'BALANCED',

    allowForeignWorkers BOOLEAN DEFAULT 1
);

-- Uploaded files relevant to function (ie - source)
-- <...>/<functionId>/<fileName>
CREATE TABLE FunctionAssets (
    functionId CHAR(36) REFERENCES Functions,
    assetId BIGINT PRIMARY KEY AUTO_INCREMENT,
    location VARCHAR(240) NOT NULL,
    fileName VARCHAR(64) NOT NULL,
    sizeBytes INT UNSIGNED NOT NULL,
    creationTs BIGINT UNSIGNED NOT NULL,
    modifiedTs BIGINT UNSIGNED NOT NULL
);

-- Worker Telemetry
CREATE TABLE Workers (
    workerId BIGINT PRIMARY KEY AUTO_INCREMENT,
    userId BIGINT REFERENCES Users,                         -- User who manages this worker
    connectTs BIGINT UNSIGNED DEFAULT NULL,
    lastSeenTs BIGINT UNSIGNED DEFAULT NULL,                -- null if still online, first time
    threads SMALLINT UNSIGNED DEFAULT 1,                    -- hardware concurrency
    acceptForeignWork BOOLEAN DEFAULT 1,

    -- this data is kinda awkard to collect but useful for policies
    userAgent TEXT DEFAULT NULL,
    ip TINYTEXT DEFAULT NULL,
    ipInfo TEXT DEFAULT NULL
);

-- Tracking info for work done by workers
CREATE TABLE Tasks (
    taskId BIGINT PRIMARY KEY AUTO_INCREMENT,
    functionId CHAR(36) REFERENCES Functions,
    workerId BIGINT DEFAULT NULL REFERENCES Workers,
    additionalData TEXT DEFAULT "",
    arriveTs BIGINT DEFAULT NULL,
    startTs BIGINT DEFAULT NULL,
    endTs BIGINT DEFAULT NULL,
    failed BOOLEAN DEFAULT 0
);

-- Logs generated by function tasks
CREATE TABLE TaskLogs (
    taskId BIGINT REFERENCES Tasks,

    -- error, info, log, warn are from the js console object
    -- fatal is automatically generated after a crash
    logType ENUM('LOG', 'CRASH') NOT NULL,

    message TEXT NOT NULL,
    ts BIGINT UNSIGNED NOT NULL
);