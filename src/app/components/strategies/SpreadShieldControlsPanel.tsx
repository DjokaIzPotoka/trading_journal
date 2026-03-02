"use client";

import * as React from "react";

const sectionClass = "rounded-xl border border-white/10 bg-[#121826] p-4 shadow-lg";
const headingClass = "mb-3 text-xs font-semibold uppercase tracking-wider text-white/70";

function SectionBlock({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <>
      {/* Desktop: always visible */}
      <div className="hidden lg:block">
        <div className={sectionClass}>
          <h2 className={headingClass}>{title}</h2>
          {children}
        </div>
      </div>
      {/* Mobile: collapsible */}
      <details
        className={`lg:hidden ${sectionClass} group`}
        open={defaultOpen}
      >
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wider text-white/70 [&::-webkit-details-marker]:hidden">
          {title}
        </summary>
        <div className="mt-3 border-t border-white/10 pt-3">{children}</div>
      </details>
    </>
  );
}

export type SpreadShieldControlsPanelProps = {
  accountSection: React.ReactNode;
  capitalSection: React.ReactNode;
  riskSection: React.ReactNode;
};

export function SpreadShieldControlsPanel({
  accountSection,
  capitalSection,
  riskSection,
}: SpreadShieldControlsPanelProps) {
  return (
    <div className="space-y-4 lg:col-span-5 overflow-y-auto scrollbar-thin pr-1">
      <SectionBlock title="Account & Structure" defaultOpen>
        {accountSection}
      </SectionBlock>
      <SectionBlock title="Capital">
        {capitalSection}
      </SectionBlock>
      <SectionBlock title="Risk & Targets">
        {riskSection}
      </SectionBlock>
    </div>
  );
}
