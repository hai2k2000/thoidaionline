import { TasksPage } from "@/app/tasks/page";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function JournalismTasksPage({ searchParams }: Props) {
  return <TasksPage searchParams={searchParams} basePath="/journalism/tasks" forceJournalism />;
}
