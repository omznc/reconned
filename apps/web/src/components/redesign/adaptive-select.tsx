import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Radix `SelectItem` cannot have an empty value, so the empty value maps to this private value. */
const EMPTY = "__empty__";

export interface AdaptiveSelectOption {
	value: string;
	label: string;
}

interface AdaptiveSelectProps {
	value: string;
	onValueChange: (value: string) => void;
	options: AdaptiveSelectOption[];
	/** The label of the empty option (value ""). A missing placeholder means no empty option. */
	placeholder?: string;
	"aria-label"?: string;
	"aria-labelledby"?: string;
	triggerClassName?: string;
	nativeClassName?: string;
}

/**
 * A custom dropdown on a fine pointer and a native select on a coarse pointer.
 * Both render, and CSS shows one, so the server and the client markup agree.
 */
export function AdaptiveSelect({
	value,
	onValueChange,
	options,
	placeholder,
	triggerClassName,
	nativeClassName,
	...aria
}: AdaptiveSelectProps) {
	const hasEmpty = placeholder !== undefined;
	// A native select shows the first option for an unknown value. Radix shows nothing, so match it.
	const known = options.some((option) => option.value === value) || (value === "" && hasEmpty);
	const shown = known ? value : (options[0]?.value ?? value);
	return (
		<>
			<Select
				value={shown === "" ? EMPTY : shown}
				onValueChange={(next) => onValueChange(next === EMPTY ? "" : next)}
			>
				<SelectTrigger {...aria} className={cn("hidden pointer-fine:flex", triggerClassName)}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{hasEmpty ? <SelectItem value={EMPTY}>{placeholder}</SelectItem> : null}
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value === "" ? EMPTY : option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<select
				{...aria}
				value={value}
				onChange={(event) => onValueChange(event.target.value)}
				className={cn("pointer-fine:hidden", nativeClassName)}
			>
				{hasEmpty ? <option value="">{placeholder}</option> : null}
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</>
	);
}
