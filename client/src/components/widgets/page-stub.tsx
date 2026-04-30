import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";

interface PageStubProps {
  Icon: LucideIcon;
  title: string;
  blurb: string;
  bullets: string[];
}

export function PageStub({ Icon, title, blurb, bullets }: PageStubProps) {
  return (
    <Panel className="max-w-[1100px]">
      <PanelHeader className="flex items-center gap-3 pb-1">
        <div className="h-9 w-9 rounded-xl bg-accent-green/12 text-accent-pale flex items-center justify-center">
          <Icon size={16} strokeWidth={1.8} />
        </div>
        <PanelTitle className="text-[16px]">{title}</PanelTitle>
      </PanelHeader>
      <PanelBody className="pt-3 pb-7">
        <p className="text-[13px] text-ink-dim max-w-[640px] leading-relaxed">{blurb}</p>
        <ul className="mt-5 space-y-2">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] text-ink-dim">
              <span className="mt-1.5 h-1 w-1 rounded-full bg-accent-green shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 inline-flex items-center gap-2 text-[11px] text-ink-mute">
          <span className="pill-ghost">soon</span>
          <span>page is on the next sprint</span>
        </div>
      </PanelBody>
    </Panel>
  );
}
