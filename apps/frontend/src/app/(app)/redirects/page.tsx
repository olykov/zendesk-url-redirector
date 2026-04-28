"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { RedirectTable } from "@/components/redirect-table";
import { Button } from "@/components/ui/button";

export default function RedirectsPage() {
  return (
    <div className="space-y-1">
      <PageHeader
        eyebrow="Manage"
        title="Redirects"
        description="Mirror of Zendesk Guide redirect rules. Click any row to inspect, copy, or delete."
        actions={
          <Button asChild variant="primary" size="default">
            <Link href="/add">
              <Plus className="h-3.5 w-3.5" />
              New redirect
            </Link>
          </Button>
        }
      />
      <RedirectTable />
    </div>
  );
}
