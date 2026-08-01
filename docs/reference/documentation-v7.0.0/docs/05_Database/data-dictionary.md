# Dictionnaire de données v6.1

## disciplines
`id`, `code`, `name`, `description`, `icon`, `display_order`, `status`, timestamps.

## championships
`id`, `discipline_id` FK NOT NULL, `code`, `official_name`, `short_name`, `description`, `logo_url`, `status`.

## categories
`id`, `championship_id` FK NOT NULL, `code`, `name`, `short_name`, `display_order`, `status`.

## seasons
`id`, `championship_id` FK NOT NULL, `category_id` FK NULL, `label`, `year`, `starts_on`, `ends_on`, `status`, `origin`.

`origin` vaut `manual`, `provider` ou `mixed`. Il reste technique.

## events
`id`, `season_id` FK NOT NULL, `name`, `event_number`, `starts_at`, `ends_at`, `status`, `circuit_id`, `venue_id`, `origin`.

## sessions
`id`, `event_id` FK NOT NULL, `type`, `display_name`, `starts_at`, `ends_at`, `timezone`, `status`, `is_race`, `is_sprint_race`, `origin`.

## provider_mappings
`id`, `provider_id`, `entity_type`, `external_id`, `canonical_id`, `confidence`, `mapping_status`, timestamps.
