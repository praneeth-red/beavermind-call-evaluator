alter table public.runs
  drop constraint if exists runs_transcript_check;

alter table public.runs
  add constraint runs_transcript_check
  check (char_length(transcript) between 1 and 500000);
