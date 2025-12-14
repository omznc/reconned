# APIs to Implement - Backend Migration

This document lists all Prisma database operations found in the frontend that need to be migrated to backend APIs. Each entry includes file paths where the Prisma calls are currently used.

## User APIs

### User Profile
- `GET /api/users/:id` - Get user by ID with clubMembership and eventRegistration **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(user)/user/page.tsx:19` - `prisma.user.findUnique` with include clubMembership and eventRegistration
  - **Context**: Used in user profile page to display user's clubs and events

- `GET /api/users` - List users (with pagination, search, sorting) **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/(public)/users/page.tsx:36` - Raw SQL query with pagination
  - **Context**: Public users listing page with admin priority sorting

- `GET /api/users/:id/profile` - Get user profile page data (clubMembership, eventRegistration filtered by privacy) **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/(public)/users/[id]/page.tsx:15` - `prisma.user.findFirst` with filtered includes
  - **Context**: Public user profile with privacy filtering applied

- `PUT /api/users/:id` - Update user information (name, bio, location, website, phone, slug, callsign, privacy settings, images) **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(user)/user/settings/_components/user-info.action.ts:32` - `prisma.user.update`
  - **Context**: Server action for updating user profile information

- `DELETE /api/users/:id/image` - Delete user avatar **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(user)/user/settings/_components/user-info.action.ts:94` - `prisma.user.update` with image: null
  - **Context**: Server action to remove user avatar

- `DELETE /api/users/:id/header-image` - Delete user header image **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(user)/user/settings/_components/user-info.action.ts:118` - `prisma.user.update` with headerImage: null
  - **Context**: Server action to remove user header image

- `POST /api/users/:id/image/upload-url` - Get S3 upload URL for user avatar
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(user)/user/settings/_components/user-info.action.ts:69` - `getS3FileUploadUrl`
  - **Context**: Server action to get presigned URL for avatar upload

- `POST /api/users/:id/header-image/upload-url` - Get S3 upload URL for user header image
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(user)/user/settings/_components/user-info.action.ts:81` - `getS3FileUploadUrl`
  - **Context**: Server action to get presigned URL for header image upload

- `GET /api/users/:id/stats` - Get user statistics (_count of eventRegistration, clubMembership, reviewsWritten, reviewsReceived) **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/page.tsx:22` - `prisma.user.findUnique` with _count select
  - **Context**: Dashboard page showing user statistics and club memberships

- `GET /api/users/:id/account` - Check if user has password (account.findFirst) **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(user)/user/security/page.tsx:15` - `prisma.account.findFirst` checking for password
  - **Context**: Security settings page to show if user has password set

### User Settings
- `PUT /api/users/:id/theme` - Update user theme preference **[DONE]**
  - **Current usage**: `apps/web/src/lib/global-actions/theme.ts:18` - `prisma.user.update` with theme field
  - **Context**: Global action to update user theme preference

- `PUT /api/users/:id/font` - Update user font preference **[DONE]**
  - **Current usage**: `apps/web/src/lib/global-actions/font.ts:18` - `prisma.user.update` with font field
  - **Context**: Global action to update user font preference

- `PUT /api/users/:id/style` - Update user style preference **[DONE]**
  - **Current usage**: `apps/web/src/lib/global-actions/style.ts:18` - `prisma.user.update` with style field
  - **Context**: Global action to update user style preference

### User Invites
- `GET /api/users/invites` - Get pending club invites for current user **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(user)/user/invites/page.tsx:19` - `prisma.clubInvite.findMany` filtered by email and PENDING status
  - **Context**: User invites page showing pending invitations

- `GET /api/users/invites/count` - Get count of pending invites **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/layout.tsx:46` - `prisma.clubInvite.count` for sidebar badge
  - **Context**: Dashboard layout sidebar showing invite count badge

## Club APIs

### Club CRUD
- `GET /api/clubs` - List clubs (with pagination, search, sorting)
  - **Current usage**: `apps/web/src/app/api/clubs/route.ts:19` - `prisma.club.findMany`
  - **Context**: API route for clubs listing (already exists but may need enhancement)

- `GET /api/clubs/:id` - Get club by ID or slug (with members, posts, _count) **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/(public)/clubs/[id]/page.tsx:29` - `prisma.club.findFirst` with OR condition for id/slug
  - **Context**: Public club detail page

- `GET /api/clubs/:id/information` - Get club information for editing (with members check) **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/information/page.tsx:17` - `prisma.club.findUnique` with membership check
  - **Context**: Club information edit page for managers/owners

- `POST /api/clubs` - Create club **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.action.ts:39` - `prisma.club.upsert` (create branch)
  - **Context**: Server action to create new club

- `PUT /api/clubs/:id` - Update club information **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.action.ts:39` - `prisma.club.upsert` (update branch)
  - **Context**: Server action to update club information

- `DELETE /api/clubs/:id` - Delete club **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.action.ts:254` - `prisma.club.delete`
  - **Context**: Server action to delete club

- `GET /api/clubs/:id/members` - Get club members (with pagination, search, filtering by role) **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/members/page.tsx:70` - `prisma.clubMembership.findMany` with pagination and search
  - **Context**: Club members table page

- `GET /api/clubs/:id/managers` - Get club managers (with pagination, search) **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/members/managers/page.tsx:90` - `prisma.clubMembership.findMany` filtered by MANAGER/CLUB_OWNER roles
  - **Context**: Club managers management page

- `GET /api/clubs/:id/stats` - Get club statistics (members over time, role distribution, events per month, recent events)
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/stats/page.tsx:6` - Multiple queries including raw SQL for time series
  - **Context**: Club statistics dashboard with charts

- `GET /api/clubs/:id/posts` - Get club posts
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/page.tsx:34` - Included in club query
  - **Context**: Club overview page showing posts

- `GET /api/clubs/:id/purchases` - Get club purchases/spending
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/spending/page.tsx:41` - `prisma.clubPurchase.findMany` with pagination
  - **Context**: Club spending/purchases table

- `GET /api/clubs/:id/audit-logs` - Get club audit logs (with pagination, search, filtering by actionType)
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/audit/page.tsx:77` - `prisma.clubAuditLog.findMany` with pagination and filters
  - **Context**: Club audit log page for managers

- `GET /api/clubs/managed` - Get clubs managed by current user **[DONE]**
  - **Current usage**: `apps/web/src/app/api/club/managed/fetch-managed-clubs.ts:5` - `prisma.clubMembership.findMany` filtered by MANAGER/CLUB_OWNER
  - **Context**: API route to fetch clubs user manages

- `GET /api/clubs/:id/membership` - Check if user is member of club **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/(public)/clubs/[id]/page.tsx:17` - `prisma.clubMembership.findFirst` to check membership
  - **Context**: Public club page checking if current user is member

- `GET /api/clubs/:id/has-owner` - Check if club has owner **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/(public)/clubs/[id]/page.tsx:64` - `prisma.clubMembership.findFirst` checking for CLUB_OWNER
  - **Context**: Public club page checking if club has owner

- `GET /api/clubs/count` - Count clubs (with filters) **[DONE]**
  - **Current usage**: Multiple locations for pagination totals
  - **Context**: Used for pagination calculations

### Club Images
- `POST /api/clubs/:id/logo/upload-url` - Get S3 upload URL for club logo **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.action.ts:122` - `getS3FileUploadUrl`
  - **Context**: Server action to get presigned URL for logo upload

- `POST /api/clubs/:id/header-image/upload-url` - Get S3 upload URL for club header image **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.action.ts:136` - `getS3FileUploadUrl`
  - **Context**: Server action to get presigned URL for header image upload

- `DELETE /api/clubs/:id/logo` - Delete club logo **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.action.ts:150` - `prisma.club.update` with logo: null
  - **Context**: Server action to remove club logo

- `DELETE /api/clubs/:id/header-image` - Delete club header image **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.action.ts:176` - `prisma.club.update` with headerImage: null
  - **Context**: Server action to remove club header image

### Club Members
- `POST /api/clubs/:id/members` - Add member to club
  - **Current usage**: `apps/web/src/app/api/club/member-invite/[code]/route.ts:148` - Transaction creating ClubMembership
  - **Context**: API route handling invite acceptance

- `DELETE /api/clubs/:id/members/:memberId` - Remove member from club **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/members/_components/members.action.ts:36` - `prisma.clubMembership.delete`
  - **Context**: Server action to remove member

- `PUT /api/clubs/:id/members/:memberId` - Update member role (promote/demote) **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/members/managers/_components/manager.action.tsx:37` - `prisma.clubMembership.update` for promote
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/members/managers/_components/manager.action.tsx:114` - `prisma.clubMembership.update` for demote
  - **Context**: Server actions to promote/demote managers

- `PUT /api/clubs/:id/members/:memberId/extend` - Extend membership duration **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/members/_components/membership-extension.action.ts:46` - `prisma.clubMembership.update` with new endDate
  - **Context**: Server action to extend membership

- `POST /api/clubs/:id/members/leave` - Leave club **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/members/_components/members.action.ts:108` - `prisma.clubMembership.delete`
  - **Context**: Server action for user to leave club

- `GET /api/clubs/:id/members/count` - Count members (with filters) **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/members/page.tsx:101` - `prisma.clubMembership.count` for pagination
  - **Context**: Used for pagination in members table

### Club Invites
- `GET /api/clubs/:id/invites` - Get club invites (with pagination, search, filtering by status) **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/members/invitations/page.tsx:80` - `prisma.clubInvite.findMany` with pagination
  - **Context**: Club invitations table page

- `POST /api/clubs/:id/invites` - Send club invitation **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/members/invitations/_components/invitations.action.tsx:58` - `prisma.clubInvite.create`
  - **Context**: Server action to send invitation email

- `PUT /api/clubs/:id/invites/:inviteId/revoke` - Revoke invitation **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/members/invitations/_components/invitations.action.tsx:142` - `prisma.clubInvite.update` with status REVOKED
  - **Context**: Server action to revoke pending invitation

- `GET /api/clubs/:id/invites/count` - Count invites (with filters) **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/members/invitations/page.tsx:79` - `prisma.clubInvite.count` for pagination
  - **Context**: Used for pagination in invitations table

- `GET /api/clubs/:id/invites/requests-count` - Get count of invite requests by club (groupBy) **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/layout.tsx:53` - `prisma.clubInvite.groupBy` by clubId
  - **Context**: Dashboard sidebar showing invite request counts per club

### Club Rules
- `GET /api/clubs/:id/rules` - Get club rules **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/events/rules/page.tsx:9` - `prisma.clubRule.findMany`
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/events/create/page.tsx:24` - `prisma.clubRule.findMany` for event form
  - **Context**: Rules listing page and event creation form

- `GET /api/clubs/:id/rules/:ruleId` - Get specific rule **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/events/rules/page.tsx:14` - `prisma.clubRule.findUnique` for editing
  - **Context**: Rules form when editing existing rule

- `POST /api/clubs/:id/rules` - Create club rule **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/events/rules/_components/rules.action.ts:23` - `prisma.clubRule.create`
  - **Context**: Server action to create new rule

- `PUT /api/clubs/:id/rules/:ruleId` - Update club rule **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/events/rules/_components/rules.action.ts:12` - `prisma.clubRule.update`
  - **Context**: Server action to update existing rule

- `DELETE /api/clubs/:id/rules/:ruleId` - Delete club rule **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/events/rules/_components/rules.action.ts:51` - `prisma.clubRule.delete`
  - **Context**: Server action to delete rule

### Club Posts
- `GET /api/clubs/:id/posts` - Get club posts **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/page.tsx:34` - Included in club query
  - **Context**: Club overview page showing posts

- `GET /api/clubs/:id/posts/:postId` - Get specific post **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/posts/page.tsx:9` - `prisma.post.findUnique` for editing
  - **Context**: Post form when editing existing post

- `POST /api/clubs/:id/posts` - Create post **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/posts/_components/posts.action.ts:45` - `prisma.post.create`
  - **Context**: Server action to create new post

- `PUT /api/clubs/:id/posts/:postId` - Update post **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/posts/_components/posts.action.ts:33` - `prisma.post.update`
  - **Context**: Server action to update existing post

- `DELETE /api/clubs/:id/posts/:postId` - Delete post **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/posts/_components/posts.action.ts:99` - `prisma.post.delete`
  - **Context**: Server action to delete post

- `POST /api/clubs/:id/posts/images/upload-url` - Get S3 upload URL for post images **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/posts/_components/posts.action.ts:119` - `getS3FileUploadUrl`
  - **Context**: Server action to get presigned URL for post image uploads

### Club Spending/Purchases
- `GET /api/clubs/:id/purchases` - Get club purchases (with pagination, search, sorting) **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/spending/page.tsx:41` - `prisma.clubPurchase.findMany` with pagination
  - **Context**: Purchases table page

- `GET /api/clubs/:id/purchases/:purchaseId` - Get specific purchase **[DONE]**
  - **Current usage**: Not directly queried, but used in update operations
  - **Context**: Used internally for updates

- `POST /api/clubs/:id/purchases` - Create purchase **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/spending.action.ts:34` - `prisma.clubPurchase.create`
  - **Context**: Server action to create new purchase

- `PUT /api/clubs/:id/purchases/:purchaseId` - Update purchase **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/spending.action.ts:51` - `prisma.clubPurchase.update`
  - **Context**: Server action to update existing purchase

- `DELETE /api/clubs/:id/purchases/:purchaseId` - Delete purchase **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/spending.action.ts:79` - `prisma.clubPurchase.delete`
  - **Context**: Server action to delete purchase

- `POST /api/clubs/:id/purchases/receipts/upload-url` - Get S3 upload URL for purchase receipt **[DONE]**
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/spending.action.ts:101` - `getS3FileUploadUrl`
  - **Context**: Server action to get presigned URL for receipt uploads

### Club Storage Quota
- `GET /api/clubs/:id/storage-quota` - Check club storage quota (calculate from posts and purchases)
  - **Current usage**: `apps/web/src/lib/storage-quota.ts:39` - Queries `prisma.post.findMany` and `prisma.clubPurchase.findMany` to calculate usage
  - **Context**: Utility function to check storage limits before uploads

- `GET /api/users/:id/daily-quota` - Check user daily upload quota (based on audit logs)
  - **Current usage**: `apps/web/src/lib/storage-quota.ts:116` - `prisma.clubAuditLog.count` for today's uploads
  - **Context**: Utility function to check daily upload limits

### Club Instagram Integration
- `GET /api/clubs/:id/instagram/auth-url` - Get Instagram authorization URL
  - **Current usage**: `apps/web/src/lib/instagram.ts:66` - `getInstagramAuthUrl` function (no Prisma, but used in club context)
  - **Context**: Club information page to connect Instagram

- `POST /api/clubs/:id/instagram/disconnect` - Disconnect Instagram account
  - **Current usage**: `apps/web/src/lib/instagram.ts:381` - `disconnectInstagramAPI` function with `prisma.club.update`
  - **Context**: Server action to disconnect Instagram

- `GET /api/clubs/:id/instagram/check-token` - Check and refresh Instagram token
  - **Current usage**: `apps/web/src/lib/instagram.ts:287` - `checkAndRefreshToken` function with `prisma.club.findUnique` and `prisma.club.update`
  - **Context**: Utility function to validate and refresh Instagram tokens

## Event APIs

### Event CRUD
- `GET /api/events` - List events (with pagination, search, sorting, privacy filtering)
  - **Current usage**: `apps/web/src/app/[locale]/(public)/events/page.tsx:21` - `prisma.event.findMany` with privacy filtering
  - **Context**: Public events listing page

- `GET /api/events/:id` - Get event by ID or slug (with rules, club, _count)
  - **Current usage**: `apps/web/src/app/[locale]/(public)/events/[id]/page.tsx:40` - `prisma.event.findFirst` with OR for id/slug
  - **Context**: Public event detail page

- `GET /api/events/upcoming` - Get upcoming events (with privacy filtering)
  - **Current usage**: `apps/web/src/app/[locale]/(public)/page.tsx:118` - `prisma.event.findMany` filtered by dateStart >= now
  - **Context**: Home page showing upcoming events

- `GET /api/events/calendar` - Get events for calendar view (date range filtering)
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/events/calendar/page.tsx:13` - `prisma.event.findMany` with date range
  - **Current usage**: `apps/web/src/app/[locale]/(public)/page.tsx:100` - `prisma.event.findMany` for home calendar
  - **Context**: Calendar component showing events in date range

- `POST /api/events` - Create event
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/events/create/_components/events.action.ts:127` - `prisma.event.upsert` (create branch)
  - **Context**: Server action to create new event

- `PUT /api/events/:id` - Update event
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/events/create/_components/events.action.ts:127` - `prisma.event.upsert` (update branch)
  - **Context**: Server action to update existing event

- `DELETE /api/events/:id` - Delete event
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/events/create/_components/events.action.ts:203` - `prisma.event.delete`
  - **Context**: Server action to delete event

- `GET /api/events/count` - Count events (with filters)
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(user)/events/page.tsx:71` - `prisma.event.count` for pagination
  - **Context**: Used for pagination in events table

- `GET /api/clubs/:clubId/events` - Get events for specific club (with pagination, search, sorting)
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/events/page.tsx:55` - `prisma.event.findMany` filtered by clubId
  - **Context**: Club events table page

- `GET /api/clubs/:clubId/events/count` - Count events for club
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/events/page.tsx:69` - `prisma.event.count` for pagination
  - **Context**: Used for pagination in club events table

### Event Images
- `POST /api/events/:id/image/upload-url` - Get S3 upload URL for event image
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/events/create/_components/events.action.ts:134` - `getS3FileUploadUrl`
  - **Context**: Server action to get presigned URL for event image upload

- `DELETE /api/events/:id/image` - Delete event image
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/events/create/_components/events.action.ts:163` - `prisma.event.update` with image: null
  - **Context**: Server action to remove event image

### Event Registration
- `GET /api/events/:id/registrations` - Get event registrations
  - **Current usage**: Not directly queried, but included in event queries with _count
  - **Context**: Used in event detail pages

- `POST /api/events/:id/registrations` - Create/update event registration
  - **Current usage**: `apps/web/src/app/[locale]/(public)/events/[id]/apply/_components/event-application.action.ts:95` - Transaction with `prisma.eventRegistration.update` or `create`
  - **Context**: Server action to submit event application

- `PUT /api/events/:id/registrations/:registrationId/attendance` - Toggle attendance
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/events/[id]/attendance/_components/attendance.action.ts:27` - `prisma.eventRegistration.update` with attended field
  - **Context**: Server action to mark attendance for event

- `GET /api/events/:id/registrations/count` - Count registrations
  - **Current usage**: Included in event queries with `_count.eventRegistration`
  - **Context**: Used to display registration count

### Event Rules
- `GET /api/events/:id/rules` - Get rules associated with event
  - **Current usage**: Included in event queries with `include: { rules: true }`
  - **Context**: Event detail pages showing associated rules

## Dashboard APIs

### Dashboard Layout
- `GET /api/dashboard/clubs` - Get clubs for sidebar (with events preview)
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/layout.tsx:22` - `prisma.club.findMany` with events included
  - **Context**: Dashboard sidebar showing user's clubs

- `GET /api/dashboard/invites-count` - Get count of pending invites for user
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/layout.tsx:46` - `prisma.clubInvite.count` for sidebar badge
  - **Context**: Dashboard sidebar invite count badge

- `GET /api/dashboard/invite-requests-count` - Get count of invite requests by club (groupBy)
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/layout.tsx:53` - `prisma.clubInvite.groupBy` by clubId
  - **Context**: Dashboard sidebar showing invite request counts per managed club

### Dashboard Stats
- `GET /api/dashboard/stats` - Get user dashboard statistics (user stats with clubMembership, eventRegistration, reviews)
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/page.tsx:22` - `prisma.user.findUnique` with complex includes and _count
  - **Context**: Main dashboard page showing user statistics and club overviews

## Admin APIs

### Admin Users
- `GET /api/admin/users` - List all users (with pagination, search, sorting)
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(platform)/admin/users/page.tsx:55` - `prisma.user.findMany` with pagination
  - **Context**: Admin users management page

- `GET /api/admin/users/:id` - Get user details (with clubMembership)
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(platform)/admin/users/page.tsx:16` - `prisma.user.findUnique` with clubMembership include
  - **Context**: Admin user detail sheet/modal

- `GET /api/admin/users/count` - Count users
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(platform)/admin/users/page.tsx:73` - `prisma.user.count` for pagination
  - **Context**: Used for pagination in admin users table

### Admin Clubs
- `GET /api/admin/clubs` - List all clubs (with pagination, search, sorting)
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(platform)/admin/clubs/page.tsx:45` - `prisma.club.findMany` with pagination
  - **Context**: Admin clubs management page

- `GET /api/admin/clubs/:id` - Get club details
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(platform)/admin/clubs/page.tsx:56` - `prisma.club.findUnique`
  - **Context**: Admin club detail sheet/modal

- `GET /api/admin/clubs/count` - Count clubs
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(platform)/admin/clubs/page.tsx:52` - `prisma.club.count` for pagination
  - **Context**: Used for pagination in admin clubs table

- `PUT /api/admin/clubs/:id/ban` - Ban club
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(platform)/admin/clubs/_components/club.actions.ts:17` - `prisma.club.update` with banned: true
  - **Context**: Admin action to ban club

- `PUT /api/admin/clubs/:id/unban` - Unban club
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(platform)/admin/clubs/_components/club.actions.ts:22` - `prisma.club.update` with banned: false
  - **Context**: Admin action to unban club

- `DELETE /api/admin/clubs/:id` - Delete club
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(platform)/admin/clubs/_components/club.actions.ts:27` - `prisma.club.delete`
  - **Context**: Admin action to delete club

### Admin Unclaimed Clubs
- `GET /api/admin/unclaimed-clubs` - List unclaimed clubs (with pagination, search, sorting)
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/page.tsx:48` - `prisma.club.findMany` filtered by no CLUB_OWNER
  - **Context**: Admin unclaimed clubs management page

- `GET /api/admin/unclaimed-clubs/:id` - Get unclaimed club details
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/page.tsx:65` - `prisma.club.findUnique`
  - **Context**: Admin unclaimed club detail sheet/modal

- `GET /api/admin/unclaimed-clubs/count` - Count unclaimed clubs
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/page.tsx:62` - `prisma.club.count` for pagination
  - **Context**: Used for pagination in unclaimed clubs table

- `POST /api/admin/unclaimed-clubs` - Create unclaimed club
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/_components/unclaimed-clubs.actions.tsx:60` - `prisma.club.create`
  - **Context**: Admin action to create unclaimed club

- `PUT /api/admin/unclaimed-clubs/:id/logo` - Update unclaimed club logo
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/_components/unclaimed-clubs.actions.tsx:144` - `prisma.club.update` with logo
  - **Context**: Admin action to set logo for unclaimed club

- `PUT /api/admin/unclaimed-clubs/:id/header-image` - Update unclaimed club header image
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/_components/unclaimed-clubs.actions.tsx:201` - `prisma.club.update` with headerImage
  - **Context**: Admin action to set header image for unclaimed club

- `POST /api/admin/unclaimed-clubs/:id/assign-owner` - Assign club owner
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/_components/unclaimed-clubs.actions.tsx:236` - `prisma.clubMembership.create` with CLUB_OWNER role
  - **Context**: Admin action to assign owner to unclaimed club

- `POST /api/admin/unclaimed-clubs/:id/claim-request` - Send claim request email
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/_components/unclaimed-clubs.actions.tsx:288` - `prisma.user.findMany` to get admin emails
  - **Context**: Admin action to send claim request email to admins

## Public APIs

### Public Clubs
- `GET /api/public/clubs` - List public clubs (with pagination, verified sorting, member count)
  - **Current usage**: `apps/web/src/app/[locale]/(public)/clubs/page.tsx:37` - Raw SQL query with GROUP BY for member count
  - **Context**: Public clubs listing page with verified priority

- `GET /api/public/clubs/:id` - Get public club by ID or slug (with posts, members, privacy filtering)
  - **Current usage**: `apps/web/src/app/[locale]/(public)/clubs/[id]/page.tsx:29` - `prisma.club.findFirst` with privacy filtering
  - **Context**: Public club detail page

- `GET /api/public/clubs/map` - Get clubs for map (with coordinates)
  - **Current usage**: `apps/web/src/app/[locale]/(public)/map/page.tsx:11` - `prisma.club.findMany` filtered by coordinates
  - **Context**: Map page showing club locations

### Public Events
- `GET /api/public/events` - List public upcoming events
  - **Current usage**: `apps/web/src/app/[locale]/(public)/events/page.tsx:21` - `prisma.event.findMany` with privacy filtering
  - **Context**: Public events listing page

- `GET /api/public/events/:id` - Get public event by ID or slug (with privacy filtering)
  - **Current usage**: `apps/web/src/app/[locale]/(public)/events/[id]/page.tsx:40` - `prisma.event.findFirst` with privacy filtering
  - **Context**: Public event detail page

### Public Users
- `GET /api/public/users` - List public users (with pagination, admin sorting)
  - **Current usage**: `apps/web/src/app/[locale]/(public)/users/page.tsx:36` - Raw SQL query with CASE for admin priority
  - **Context**: Public users listing page

- `GET /api/public/users/:id` - Get public user by ID or slug (with filtered clubMembership and eventRegistration)
  - **Current usage**: `apps/web/src/app/[locale]/(public)/users/[id]/page.tsx:15` - `prisma.user.findFirst` with privacy filtering
  - **Context**: Public user profile page

### Search
- `GET /api/search` - Search clubs, users, and events (with pagination, filtering by type)
  - **Current usage**: `apps/web/src/app/[locale]/(public)/search/page.tsx:116` - Multiple `prisma.club.findMany`, `prisma.user.findMany`, `prisma.event.findMany` queries
  - **Context**: Search page with tabs for clubs/users/events

## Utility APIs

### Slug Validation
- `POST /api/validate-slug` - Validate slug availability (for club, event, or user)
  - **Current usage**: `apps/web/src/components/slug/validate-slug.ts:26` - Multiple `prisma.club.findUnique`, `prisma.event.findUnique`, `prisma.user.findUnique` checks
  - **Context**: Used in forms to validate slug uniqueness before submission

### Audit Logging
- `POST /api/audit-logs` - Create audit log entry (internal, called by actions)
  - **Current usage**: `apps/web/src/lib/audit-logger.ts:61` - `prisma.clubAuditLog.create`
  - **Context**: Utility function called by server actions to log changes

### Reviews
- `GET /api/reviews` - Get reviews (filtered by clubId, eventId, or userId)
  - **Current usage**: `apps/web/src/components/overviews/reviews/reviews-overview.tsx:27` - `prisma.review.findMany` with different where clauses
  - **Context**: Reviews overview component for clubs/events/users

- `GET /api/reviews/:type/:id` - Get reviews for specific entity (club/event/user)
  - **Current usage**: Same as above, different where filters based on type
  - **Context**: Reviews component showing ratings and reviews

## Sitemap
- `GET /api/sitemap` - Generate sitemap (clubs, events, users)
  - **Current usage**: `apps/web/src/app/sitemap.ts:24` - `prisma.club.findMany`, `prisma.event.findMany`, `prisma.user.findMany` for sitemap generation
  - **Context**: Next.js sitemap route generating XML sitemap

## Special Queries

### Raw SQL Queries
- Club listing with member count (raw SQL with GROUP BY)
  - **Current usage**: `apps/web/src/app/[locale]/(public)/clubs/page.tsx:37` - `prisma.$queryRaw` with JOIN and GROUP BY
  - **Context**: Public clubs page needing member count aggregation

- User listing with admin priority (raw SQL with CASE)
  - **Current usage**: `apps/web/src/app/[locale]/(public)/users/page.tsx:36` - `prisma.$queryRaw` with CASE for admin sorting
  - **Context**: Public users page prioritizing admins

- Club stats - members over time (raw SQL with recursive CTE)
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/stats/page.tsx:18` - `prisma.$queryRaw` with recursive CTE
  - **Context**: Club statistics page showing member growth over time

- Club stats - events per month (raw SQL with recursive CTE)
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/stats/page.tsx:45` - `prisma.$queryRaw` with recursive CTE
  - **Context**: Club statistics page showing event frequency

### Complex Aggregations
- Dashboard invite requests count by club (groupBy)
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/layout.tsx:53` - `prisma.clubInvite.groupBy` by clubId
  - **Context**: Dashboard sidebar showing invite request counts per managed club

- Club role distribution (groupBy)
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/(club)/[clubId]/club/stats/page.tsx:38` - `prisma.clubMembership.groupBy` by role
  - **Context**: Club statistics showing member role distribution

- User statistics with nested counts (_count.eventRegistration, _count.clubMembership, etc.)
  - **Current usage**: `apps/web/src/app/[locale]/dashboard/page.tsx:22` - `prisma.user.findUnique` with nested _count selects
  - **Context**: Dashboard showing user statistics

## Notes

- All APIs should support pagination (page, perPage)
- All list APIs should support search and sorting
- Privacy filtering should be applied where appropriate (isPrivate checks)
- Authentication/authorization checks should be implemented for all endpoints
- File upload URLs should be generated server-side with proper validation
- Storage quota checks should be performed before allowing uploads
- Audit logging should be integrated into all mutation operations
- Raw SQL queries should be preserved where they provide performance benefits
- Complex includes and nested counts should be optimized for performance
