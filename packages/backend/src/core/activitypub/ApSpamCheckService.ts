/*
 * SPDX-FileCopyrightText: AmaseCocoa
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import type { MiRemoteUser } from '@/models/User.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { bindThis } from '@/decorators.js';
import type { FollowingsRepository } from '@/models/_.js';
import { MetaService } from '../MetaService.js';
import { ApResolverService } from './ApResolverService.js';
import { isActor } from './type.js';

type ActorStats = {
	followingCount: number | null;
	followersCount: number | null;
	createdAt: Temporal.ZonedDateTime | null;
};

@Injectable()
export class ApSpamCheckService {
	constructor(
		private followingsRepository: FollowingsRepository,

		private apResolverService: ApResolverService,
		private metaService: MetaService,
	) {}

	@bindThis
	private async fetchFollowStats(actor: MiRemoteUser): Promise<ActorStats> {
		const resolver = await this.apResolverService.createResolver();
		const person = await resolver.resolve(actor.uri);

		if (!isActor(person)) throw new IdentifiableError('a', 'b');
		const [following, followers] = await Promise.all([
			person.following != null
				? resolver.resolveCollection(person.following).catch(() => null)
				: null,
			person.followers != null
				? resolver.resolveCollection(person.followers).catch(() => null)
				: null,
		]);

		const published = (() => {
			if (person.published) {
				const instant = Temporal.Instant.from(person.published);
				const zonedDate = instant.toZonedDateTimeISO('UTC');
				return zonedDate;
			} else {
				return null;
			}
		})();

		return {
			followingCount: following?.totalItems ?? null,
			followersCount: followers?.totalItems ?? null,
			createdAt: published,
		};
	}

	@bindThis
	public async checkActor(actor: MiRemoteUser): Promise<boolean> {
		const meta = await this.metaService.fetch();

		if (meta.enableRemoteSpamFollowingDetection) {
			const isFollowedByLocalUser = await this.followingsRepository.exists({
				where: {
					followeeId: actor.id,
					followerHost: IsNull(),
				},
			});

			if (isFollowedByLocalUser) {
				return false;
			}

			const stats = await this.fetchFollowStats(actor);
			if (stats.createdAt && stats.followersCount && stats.followingCount) {
				if (stats.followingCount >= 50) {
					const today = Temporal.Now.plainDateISO();

					const duration = today.since(stats.createdAt, { largestUnit: 'day' });

					if (duration.days <= 3) {
						const safeFollowers =
							stats.followersCount === 0 ? 1 : stats.followersCount;
						const followersRatio = stats.followingCount / safeFollowers;

						if (followersRatio >= 30.0) {
							return true;
						}
					}
				}
			}
		}
		return false;
	}
}
