import {
  Building2, Droplets, Hammer, Home, Layers, Paintbrush, Ruler, Wrench, Zap, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Building2, Home, Zap, Droplets, Hammer, Paintbrush, Wrench, Ruler, Layers,
};

export function ServiceIcon({ name, size = 20 }: { name?: string | null; size?: number }) {
  const Icon = ICONS[name ?? "Hammer"] ?? Hammer;
  return <Icon size={size} strokeWidth={1.8} />;
}
