-- 來源 (Source) tracking: how the task request was received.
create type taskflow.task_source_channel_enum as enum ('Email', 'Meeting', 'Verbal', 'Other');

alter table taskflow.tasks
  add column source_channel taskflow.task_source_channel_enum,
  add column source_note text;

comment on column taskflow.tasks.source_channel is '來源類型：Email／會議／口頭告知／其他。';
comment on column taskflow.tasks.source_note is '來源說明（自由輸入），例如「9/10 王小姐」「週一晨會」「陳經理」。';

-- Aircraft Type: single-select -> multi-select array (常有全機型或多機型要一起排的情況).
alter table taskflow.tasks add column aircraft_type_multi taskflow.aircraft_type_enum[] not null default '{}';
update taskflow.tasks set aircraft_type_multi = case when aircraft_type is not null then array[aircraft_type] else '{}' end;
alter table taskflow.tasks drop column aircraft_type;
alter table taskflow.tasks rename column aircraft_type_multi to aircraft_type;

-- Station: single-select -> multi-select array (A321/A339 常同時常駐 RMQ 與 KHH).
alter table taskflow.tasks add column station_multi taskflow.station_enum[] not null default '{}';
update taskflow.tasks set station_multi = case when station is not null then array[station] else '{}' end;
alter table taskflow.tasks drop column station;
alter table taskflow.tasks rename column station_multi to station;

create index tasks_aircraft_type_gin_idx on taskflow.tasks using gin (aircraft_type);
create index tasks_station_gin_idx on taskflow.tasks using gin (station);

comment on column taskflow.tasks.aircraft_type is '機型（可複選，儲存為陣列）。';
comment on column taskflow.tasks.station is '基地（可複選，儲存為陣列）。';
