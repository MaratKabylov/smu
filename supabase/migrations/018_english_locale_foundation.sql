-- English is an optional content translation. Russian and Kazakh remain the
-- required editorial pair until an English translation is supplied.

alter table public.article_translations drop constraint article_translations_locale_check;
alter table public.article_translations add constraint article_translations_locale_check check (locale in ('ru', 'kk', 'en'));

alter table public.scientist_profile_translations drop constraint scientist_profile_translations_locale_check;
alter table public.scientist_profile_translations add constraint scientist_profile_translations_locale_check check (locale in ('ru', 'kk', 'en'));

alter table public.science_work_translations drop constraint science_work_translations_locale_check;
alter table public.science_work_translations add constraint science_work_translations_locale_check check (locale in ('ru', 'kk', 'en'));

alter table public.mentorship_offer_translations drop constraint mentorship_offer_translations_locale_check;
alter table public.mentorship_offer_translations add constraint mentorship_offer_translations_locale_check check (locale in ('ru', 'kk', 'en'));

alter table public.research_program_translations drop constraint research_program_translations_locale_check;
alter table public.research_program_translations add constraint research_program_translations_locale_check check (locale in ('ru', 'kk', 'en'));

alter table public.event_translations drop constraint event_translations_locale_check;
alter table public.event_translations add constraint event_translations_locale_check check (locale in ('ru', 'kk', 'en'));

alter table public.slug_redirects drop constraint slug_redirects_locale_check;
alter table public.slug_redirects add constraint slug_redirects_locale_check check (locale in ('ru', 'kk', 'en'));

alter table public.mentorship_applications drop constraint mentorship_applications_locale_check;
alter table public.mentorship_applications add constraint mentorship_applications_locale_check check (locale in ('ru', 'kk', 'en'));

alter table public.research_program_applications drop constraint research_program_applications_locale_check;
alter table public.research_program_applications add constraint research_program_applications_locale_check check (locale in ('ru', 'kk', 'en'));

comment on column public.article_translations.locale is 'BCP 47 language key supported by the application; currently ru, kk, en.';
