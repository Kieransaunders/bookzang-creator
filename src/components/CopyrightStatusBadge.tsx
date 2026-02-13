import {
  getCopyrightStatusLabel,
  getCopyrightStatusBadgeClass,
  getCopyrightStatusIcon,
  getCopyrightStatusDescription,
} from "@/lib/copyrightStatus";

interface CopyrightStatusBadgeProps {
  status?: string;
  showIcon?: boolean;
  className?: string;
}

export function CopyrightStatusBadge({
  status,
  showIcon = true,
  className = "",
}: CopyrightStatusBadgeProps) {
  const label = getCopyrightStatusLabel(status);
  const badgeClass = getCopyrightStatusBadgeClass(status);
  const icon = showIcon ? getCopyrightStatusIcon(status) : null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${badgeClass} ${className}`}
      title={getCopyrightStatusDescription(status)}
    >
      {icon && <span className="text-[10px]">{icon}</span>}
      <span>{label}</span>
    </span>
  );
}
