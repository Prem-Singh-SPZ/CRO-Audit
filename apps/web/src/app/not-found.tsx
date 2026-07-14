import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo className="mb-10" />
      <p className="text-6xl font-semibold tracking-tight text-gradient-primary">
        404
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        The report or page you&apos;re looking for doesn&apos;t exist or may have
        been removed.
      </p>
      <Button asChild variant="gradient" className="mt-8">
        <Link href="/">Back home</Link>
      </Button>
    </main>
  );
}
