/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class OidcSkipTwoFactor1795804149578 {
	name = 'OidcSkipTwoFactor1795804149578'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user_profile" ADD "oidcSkipTwoFactor" boolean NOT NULL DEFAULT false`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user_profile" DROP COLUMN "oidcSkipTwoFactor"`);
	}
}
