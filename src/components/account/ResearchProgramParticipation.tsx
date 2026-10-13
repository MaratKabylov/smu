import Link from "next/link";
import type { Locale } from "@/lib/i18n/locales";
import { accountRecordsCopy, accountStatus } from "@/lib/i18n/account-records";
import { researchProgramAccountCopy } from "@/lib/i18n/research-program-account";
import type { AccountResearchProgram } from "@/lib/validation/research-program-participation";
import { researchOutputLabels } from "@/types/domain/research-output";

export function ResearchProgramParticipation({ locale, data }: { locale: Locale; data: AccountResearchProgram }) {
  const copy = researchProgramAccountCopy[locale];
  const recordCopy = accountRecordsCopy[locale];
  const { program, participation } = data;
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Asia/Almaty" }).format(new Date(value.length === 10 ? value + "T00:00:00Z" : value));
  return <section className="account-claim">
    <h2>{copy.title}</h2>
    <p>{accountStatus(locale, program.status)}</p>
    <p>{copy.intake}: <time dateTime={program.applicationsOpenOn}>{date(program.applicationsOpenOn)}</time> — <time dateTime={program.applicationDeadline}>{date(program.applicationDeadline)}</time></p>
    <p>{copy.dates}: <time dateTime={program.startsOn}>{date(program.startsOn)}</time> — <time dateTime={program.endsOn}>{date(program.endsOn)}</time></p>
    {program.curriculum && <><h3>{copy.curriculum}</h3><p className="mentorship-motivation">{program.curriculum}</p></>}
    {!participation ? <p>{copy.pending}</p> : <>
      <h3>{copy.participation}</h3><p>{participation.status === "active" ? copy.active : copy.completed}</p>
      {participation.baseline ? <p>{copy.baseline}</p> : <p>{copy.started}: <time dateTime={participation.createdAt}>{date(participation.createdAt)}</time></p>}
      <h3>{copy.mentor}</h3>
      {participation.mentor ? <><p>{participation.mentor.name}</p>
        {participation.mentor.locale !== locale && <p>{recordCopy.fallback}: {participation.mentor.locale.toUpperCase()}</p>}
        <Link href={`/${participation.mentor.locale}/scientists/${participation.mentor.slug}`}>{copy.profile}</Link>
      </> : <p>{participation.mentorAssigned ? copy.unavailableMentor : copy.noMentor}</p>}
      <h3>{copy.projects}</h3>
      {!data.projects.length && <p>{copy.noProjects}</p>}
      {data.projects.map(project => <article key={project.id} className="account-record-body">
        <h4><Link href={`/${locale}/account/projects/${project.id}`}>{project.title || recordCopy.untitled}</Link></h4>
        <p>{accountStatus(locale, project.status)}</p><p>{project.summary}</p>
        {project.locale && project.locale !== locale && <p>{recordCopy.fallback}: {project.locale.toUpperCase()}</p>}
        <h5>{copy.outputs}</h5><p>{copy.outputsIntro}</p>
        {!project.outputs.length && <p>{copy.noOutputs}</p>}
        {project.outputs.map(output => <article key={output.id}>
          <h6>{output.title}</h6><p>{researchOutputLabels[locale][output.kind]} · {copy.version} {output.versionLabel}</p>
          <p className="mentorship-motivation">{output.description}</p><p>{copy.license}: {output.license}</p>
          {/^https?:\/\//i.test(output.externalUrl) && <p><a href={output.externalUrl} target="_blank" rel="noreferrer">{copy.external}</a></p>}
          <ul>{output.files.map(file => <li key={file.id}><a href={`/api/results/${output.id}/files/${file.id}?version=${output.version}`}>{copy.download}: {file.name}</a></li>)}</ul>
        </article>)}
      </article>)}
    </>}
  </section>;
}
