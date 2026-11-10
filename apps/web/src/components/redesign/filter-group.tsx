import type { ReactNode } from "react";
import { useId } from "react";
import { AdaptiveSelect } from "@/components/redesign/adaptive-select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface FilterGroupProps {
	title: string;
	children: ReactNode;
	className?: string;
}

/** A titled group of filter controls. */
export function FilterGroup({ title, children, className }: FilterGroupProps) {
	return (
		<fieldset className={cn("m-0 flex min-w-0 flex-col gap-2 border-0 p-0", className)}>
			<legend className="mb-2 p-0 text-[13px] font-medium">{title}</legend>
			{children}
		</fieldset>
	);
}

interface FacetCheckboxProps {
	label: string;
	/** A missing count hides the badge. */
	count?: number | null;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	disabled?: boolean;
}

/** A checkbox with a facet count. The sidebar and the sheet can both show one, so the id is unique. */
export function FacetCheckbox({ label, count, checked, onCheckedChange, disabled }: FacetCheckboxProps) {
	const id = useId();
	return (
		<div className="flex items-center justify-between gap-2 text-[13px] leading-5">
			<div className="flex min-w-0 items-center gap-2">
				<Checkbox
					id={id}
					checked={checked}
					disabled={disabled}
					onCheckedChange={(next) => onCheckedChange(next === true)}
				/>
				<label htmlFor={id} className="min-w-0 cursor-pointer truncate">
					{label}
				</label>
			</div>
			{count === null || count === undefined ? null : (
				<span className="rounded-full bg-secondary px-[7px] py-px text-[11px] leading-4 text-muted-foreground tabular-nums">
					{count}
				</span>
			)}
		</div>
	);
}

interface FilterSelectProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	/** The text of the empty option, for example "Any city". */
	placeholder: string;
	options: { value: string; label: string }[];
}

/** A labelled native select for a filter with many values. */
export function FilterSelect({ label, value, onChange, placeholder, options }: FilterSelectProps) {
	const id = useId();
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<span id={id} className="text-[13px] font-medium">
				{label}
			</span>
			<AdaptiveSelect
				value={value}
				onValueChange={onChange}
				options={options}
				placeholder={placeholder}
				aria-labelledby={id}
				triggerClassName="w-full min-w-0 px-2.5 py-0 text-[13px]"
				nativeClassName="h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 text-[13px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
			/>
		</div>
	);
}
