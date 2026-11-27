<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<SearchMarker
	path="/settings/pherkad" :label="i18n.ts._settings.pherkad" :keywords="['pherkad']"
	icon="ti ti-north-star"
>
	<SearchMarker :keywords="['timeline', 'local', 'social', 'global']">
		<FormSection first>
			<template #label>
				<SearchLabel>{{ i18n.ts._pherkad.timeline.title }}</SearchLabel>
			</template>
			<div class="_gaps_s">
				<MkSwitch v-model="hideLTL">
					{{ i18n.ts._pherkad.timeline.hideLTL }}
					<template #caption>{{ i18n.ts._pherkad.timeline.hideLTLCaption }}</template>
				</MkSwitch>
				<MkSwitch v-model="hideGTL">
					{{ i18n.ts._pherkad.timeline.hideGTL }}
					<template #caption>{{ i18n.ts._pherkad.timeline.hideGTLCaption }}</template>
				</MkSwitch>
			</div>
		</FormSection>
	</SearchMarker>
	<SearchMarker :keywords="['openid', 'oidc']">
		<FormSection>
			<template #label>
				<SearchLabel>{{ i18n.ts._oidc.title }}</SearchLabel>
			</template>
			<div v-if="oidcStatus?.enabled || oidcStatus?.linked" class="_gaps_s">
				<p>{{ oidcStatus.linked ? i18n.ts._oidc.linked : i18n.ts._oidc.linkDescription }}</p>
				<MkSwitch
					v-if="oidcStatus.linked && account.twoFactorEnabled" :modelValue="oidcStatus.skipTwoFactor"
					@update:modelValue="updateOidcTwoFactor"
				>
					{{ i18n.ts._oidc.skipTwoFactor }}
					<template #caption>{{ i18n.ts._oidc.skipTwoFactorDescription }}</template>
				</MkSwitch>
				<MkButton v-if="oidcStatus.linked" danger @click="unlinkOidc">{{ i18n.ts._oidc.unlink }}</MkButton>
				<MkButton v-else primary @click="linkOidc">
					{{ oidcAuthorization ? i18n.ts.cancel : i18n.ts._oidc.link }}
				</MkButton>
			</div>
			<MkLoading v-else-if="oidcStatus === undefined"/>
			<MkInfo v-else-if="oidcStatus === null" warn>{{ i18n.ts.pageLoadError }}</MkInfo>
			<MkInfo v-else>{{ i18n.ts.unavailable }}</MkInfo>
		</FormSection>
	</SearchMarker>
</SearchMarker>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import FormSection from '@/components/form/section.vue';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { authorizeWithOidc, oidcErrorMessage } from '@/utility/oidc.js';
import { i18n } from '@/i18n.js';
import { ensureSignin } from '@/i.js';
import { definePage } from '@/page.js';
import { prefer } from '@/preferences';

const account = ensureSignin();
const oidcStatus = ref<{ enabled: boolean; linked: boolean; skipTwoFactor: boolean } | null>();
const oidcAuthorization = shallowRef<AbortController>();

const hideLTL = prefer.model('pherkad.hideTimeline.local');
const hideGTL = prefer.model('pherkad.hideTimeline.global');

onMounted(async () => {
	oidcStatus.value = await misskeyApi('oidc/status').catch(() => null);
});
onBeforeUnmount(() => oidcAuthorization.value?.abort());

function showOidcError(error: unknown) {
	os.alert({
		type: 'error',
		text: oidcErrorMessage(error),
	});
}

async function updateOidcTwoFactor(skipTwoFactor: boolean) {
	const auth = await os.authenticateDialog();
	if (auth.canceled) return;
	try {
		await misskeyApi('oidc/settings', { ...auth.result, skipTwoFactor });
		if (oidcStatus.value) oidcStatus.value.skipTwoFactor = skipTwoFactor;
	} catch (error) {
		showOidcError(error);
	}
}

async function linkOidc() {
	if (oidcAuthorization.value != null) {
		oidcAuthorization.value.abort();
		return;
	}
	const auth = await os.authenticateDialog();
	if (auth.canceled) return;

	const authorization = new AbortController();
	oidcAuthorization.value = authorization;
	try {
		const { response } = await authorizeWithOidc({ mode: 'link', ...auth.result }, authorization.signal);
		if (response.result === 'linked' && oidcStatus.value) oidcStatus.value.linked = true;
	} catch (error) {
		if (!authorization.signal.aborted) showOidcError(error);
	} finally {
		oidcAuthorization.value = undefined;
	}
}

async function unlinkOidc() {
	const confirm = await os.confirm({ type: 'warning', text: i18n.ts._oidc.unlinkConfirm });
	if (confirm.canceled) return;

	const auth = await os.authenticateDialog();
	if (auth.canceled) return;

	try {
		await misskeyApi('oidc/unlink', auth.result);
		if (oidcStatus.value) oidcStatus.value.linked = false;
	} catch (error) {
		showOidcError(error);
	}
}

definePage(() => ({
	title: i18n.ts._settings.pherkad,
	icon: 'ti ti-north-star',
}));
</script>
