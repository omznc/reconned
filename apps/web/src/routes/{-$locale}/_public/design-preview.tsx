import { createFileRoute, notFound } from "@tanstack/react-router";
import { Calendar, Globe, Mail, Share2, Shield, Star, Trophy, Users } from "lucide-react";
import { useState } from "react";
import { InstagramIcon } from "@/components/icons";
import { EntityRow } from "@/components/redesign/entity-row";
import { EventRow } from "@/components/redesign/event-row";
import { FacetCheckbox, FilterGroup } from "@/components/redesign/filter-group";
import { IdentityPanel } from "@/components/redesign/identity-panel";
import { ListingShell, ViewToggle } from "@/components/redesign/listing-shell";
import { MiniStatChip } from "@/components/redesign/mini-stat-chip";
import { ProfileTabs } from "@/components/redesign/profile-tabs";
import { SectionCard } from "@/components/redesign/section-card";
import { StatStrip } from "@/components/redesign/stat-strip";

export const Route = createFileRoute("/{-$locale}/_public/design-preview")({
	beforeLoad: () => {
		if (import.meta.env.PROD) {
			throw notFound();
		}
	},
	component: DesignPreview,
});

const club = { name: "SRK Tvrđava", verified: true };

function Preview() {
	const [view, setView] = useState("list");
	const [open, setOpen] = useState(true);
	const [chips, setChips] = useState(["This weekend", "Open", "BiH"]);

	return (
		<ListingShell
			title="Events"
			subtitle="38 upcoming games, 9 open this weekend"
			viewToggle={
				<ViewToggle
					label="View"
					value={view}
					onChange={setView}
					options={[
						{ value: "list", label: "List" },
						{ value: "grid", label: "Grid" },
						{ value: "calendar", label: "Calendar" },
					]}
				/>
			}
			search={{
				value: "",
				onChange: () => undefined,
				placeholder: "Event, club or city",
				label: "Search events",
			}}
			sort={{
				value: "soon",
				onChange: () => undefined,
				options: [
					{ value: "soon", label: "Soonest first" },
					{ value: "left", label: "Places left" },
				],
			}}
			chips={chips.map((label) => ({
				key: label,
				label,
				onRemove: () => setChips(chips.filter((c) => c !== label)),
			}))}
			resultCount={chips.length * 2}
			activeFilterCount={chips.length}
			onResetFilters={() => setChips([])}
			filters={
				<>
					<FilterGroup title="Registration">
						<FacetCheckbox label="Open" count={22} checked={open} onCheckedChange={setOpen} />
						<FacetCheckbox
							label="Not open yet"
							count={9}
							checked={false}
							onCheckedChange={() => undefined}
						/>
						<FacetCheckbox label="Full" count={4} checked={false} onCheckedChange={() => undefined} />
					</FilterGroup>
					<FilterGroup title="Other">
						<FacetCheckbox label="Freelancers welcome" checked={true} onCheckedChange={() => undefined} />
					</FilterGroup>
				</>
			}
		>
			<div className="flex flex-col gap-2">
				<EventRow
					href="#a"
					name="Crysis 5: warm-up game"
					dateStart="2026-11-14 07:00:00"
					dateEnd="2026-11-14 15:00:00"
					variant="thumb"
					club={club}
					place="Bivša kasarna, Kakanj"
					freelancers={true}
					placesLeft={30}
					maxAttendees={60}
					price={15}
					applyHref="/events"
					state="open"
				/>
				<EventRow
					href="#b"
					name="Bjelašnica Snow Op"
					dateStart="2026-11-14 09:00:00"
					dateEnd="2026-11-14 14:00:00"
					club={{ name: "ASK Bjelašnica Snow" }}
					place="Sarajevo"
					placesLeft={4}
					maxAttendees={40}
					price={20}
					state="closing"
					stateLabel="Closes tomorrow"
				/>
				<EventRow
					href="#c"
					name="Visoko Urban"
					dateStart="2026-11-15 10:00:00"
					club={{ name: "AK Visočki vitezovi", verified: true }}
					place="Visoko"
					placesLeft={0}
					maxAttendees={36}
					price={15}
					state="full"
				/>
				<EventRow
					href="#d"
					name="Mostar Night Op"
					dateStart="2026-12-01 18:00:00"
					club={{ name: "ASK Hercegovina" }}
					state="pending"
					stateLabel="Opens 1 Dec"
					price={0}
				/>
			</div>
		</ListingShell>
	);
}

function DesignPreview() {
	return (
		<div className="container mx-auto flex flex-col gap-10 px-4 py-8">
			<Preview />
			<div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
				<div className="flex flex-col gap-4">
					<IdentityPanel
						kind="club"
						name="Airsoft klub YARILO"
						verified={true}
						headingLevel={2}
						location="Danilovgrad, Montenegro"
						badges={[
							{ label: "Allied", icon: Shield },
							{ label: "Since 2014", icon: Calendar },
						]}
						description="MilSim and speedsoft club from Danilovgrad. Monthly games by the Zeta river."
						primaryAction={{ label: "Contact", href: "#", icon: Mail }}
						actions={[
							{ label: "Instagram", icon: InstagramIcon, href: "https://instagram.com" },
							{ label: "Website", icon: Globe, href: "https://example.com" },
							{ label: "Share", icon: Share2, onClick: () => undefined },
						]}
					/>
					<IdentityPanel
						kind="person"
						name="Sniper"
						headingLevel={2}
						location="Zenica"
						description="Playing since 2019."
						badges={[{ label: "Admin" }]}
						primaryAction={{ label: "Contact", href: "#" }}
					/>
				</div>
				<div className="flex min-w-0 flex-col gap-5">
					<ProfileTabs
						activeKey="overview"
						tabs={[
							{ key: "overview", label: "Overview", href: "#" },
							{ key: "events", label: "Events", href: "#e", count: 2 },
							{ key: "members", label: "Members", href: "#m", count: 38 },
							{ key: "reviews", label: "Reviews", href: "#r", count: null },
						]}
					/>
					<StatStrip
						items={[
							{ label: "Members", value: 38 },
							{ label: "Games hosted", value: 24 },
							{
								label: "Rating",
								value: (
									<>
										4.7
										<Star className="size-4 fill-status-soon text-status-soon" aria-hidden={true} />
									</>
								),
							},
							{ label: "Players hosted", value: null },
						]}
					/>
					<div className="flex flex-wrap gap-2">
						<MiniStatChip icon={Users} value="6.412" label="players" />
						<MiniStatChip icon={Trophy} value={148} />
					</div>
					<SectionCard
						title="Upcoming events"
						subtitle="Games this club organises"
						action={{ href: "#", label: "All events" }}
					>
						<div className="flex flex-col gap-2">
							<EventRow
								href="#e1"
								name="Zeta River Recon"
								dateStart="2026-12-06 08:00:00"
								dateEnd="2026-12-06 14:00:00"
								club={{ name: "Airsoft klub YARILO", verified: true }}
								place="Spuško polje, Danilovgrad"
								placesLeft={9}
								maxAttendees={60}
								price={15}
								state="closing"
								stateLabel="Closes in 3 days"
							/>
							<EventRow
								href="#e2"
								name="Novogodišnji speedsoft turnir"
								dateStart="2027-01-09 09:00:00"
								club={{ name: "Airsoft klub YARILO" }}
								place="Kamenolom"
								placesLeft={32}
								maxAttendees={32}
								price={10}
								state="pending"
								stateLabel="Opens 1 Dec"
							/>
						</div>
					</SectionCard>
					<div className="grid gap-2 sm:grid-cols-2">
						<EntityRow
							kind="club"
							href="#c"
							name="ASK Igman Tactical"
							subtitle="Sarajevo, 64 members"
							verified={true}
						/>
						<EntityRow kind="player" href="#p" name="Sniper" subtitle="Zenica, 4 clubs" />
					</div>
				</div>
			</div>
		</div>
	);
}
