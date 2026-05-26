ALTER TABLE public.time_blocks REPLICA IDENTITY FULL;
ALTER TABLE public.extra_shifts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.extra_shifts;