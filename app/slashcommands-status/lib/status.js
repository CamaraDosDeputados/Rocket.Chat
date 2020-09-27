import { Meteor } from 'meteor/meteor';
import { TAPi18n } from 'meteor/rocketchat:tap-i18n';

import { handleError, slashCommands } from '../../utils';
import { StreamService } from '../../../server/sdk';

function Status(command, params, item) {
	if (command === 'status') {
		const user = Meteor.users.findOne(Meteor.userId());

		Meteor.call('setUserStatus', null, params, (err) => {
			if (err) {
				if (Meteor.isClient) {
					return handleError(err);
				}

				if (err.error === 'error-not-allowed') {
					StreamService.sendEphemeralMessage(Meteor.userId(), item.rid, {
						msg: TAPi18n.__('StatusMessage_Change_Disabled', null, user.language),
					});
				}

				throw err;
			} else {
				StreamService.sendEphemeralMessage(Meteor.userId(), item.rid, {
					msg: TAPi18n.__('StatusMessage_Changed_Successfully', null, user.language),
				});
			}
		});
	}
}

slashCommands.add('status', Status, {
	description: 'Slash_Status_Description',
	params: 'Slash_Status_Params',
});
