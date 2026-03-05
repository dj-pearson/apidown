-- Migration 001: Enable TimescaleDB extension
-- Run once in Supabase SQL editor before other migrations

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
