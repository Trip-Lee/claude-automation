// Updated by Trevor
var AudienceMS = Class.create();
AudienceMS.prototype = {
    initialize: function() {
        this.tableFields = {
            'sys_user': 'user',
            'csm_consumer': 'consumer',
            'customer_contact': 'contact',
            'core_company': 'company',
            'sn_lead_mgmt_core_lead': 'lead'
        };
        this.audienceTableFields = {
            'sys_user': 'employee',
            'csm_consumer': 'consumer',
            'customer_contact': 'contact',
            'core_company': 'company',
            'sn_lead_mgmt_core_lead': 'lead'
        };
    },
    getRecordFields: function(table) {
        return this.tableFields[table];
    },

    refreshAudienceHash: function({
        audienceSysID,
        newConditions,
        update
    }) {
        let audienceMemberGR = new GlideRecord('x_cadso_automate_audience_hash');
        audienceMemberGR.addQuery('audience', audienceSysID);
        audienceMemberGR.query();
        audienceMemberGR.deleteMultiple();

        let audienceGR = new GlideRecord("x_cadso_automate_audience");
        let validAudience = audienceGR.get(audienceSysID);
        if (!validAudience) {
            throw new Error(`Error getting Audience Record for sysID ${audienceSysID}`);
        }

        let conditions = newConditions;
        if (!conditions) {
            throw new Error(`Error getting Audience conditions for sysID ${audienceSysID} - conditions : ${conditions}`);
        }

        //TODO: MAYBE ADD CHECK AGAISNT OLD CONDITIONS TO SEE IF WE NEED TO UPDATE??

        let table = audienceGR.getValue("table");
        let batchSize = 1000;
        let count = 0;
        let memberBatches = [];
        let members = new Map;
        let batch = [];

        new global.GlideQuery.parse(table, conditions)
            .select(['x_cadso_automate_contact_detail_data'])
            .forEach(member => {
                batch.push(JSON.parse(member.x_cadso_automate_contact_detail_data));
                if (batch.length === batchSize) {
                    // memberBatches.push(batch);
                    let audienceMemberGR = new GlideRecord('x_cadso_automate_audience_hash');
                    audienceMemberGR.setValue('member_hash', JSON.stringify(batch));
                    audienceMemberGR.setValue('audience', audienceSysID);
                    audienceMemberGR.insert();
                    batch = [];
                }
                count++;
            });
        // Push remaining records if not a full batch
        if (batch.length > 0) {
            let audienceMemberGR = new GlideRecord('x_cadso_automate_audience_hash');
            audienceMemberGR.setValue('member_hash', JSON.stringify(batch));
            audienceMemberGR.setValue('audience', audienceSysID);
            audienceMemberGR.insert();
        }

        // for (let i = 0; i < memberBatches.length; i++) {

        // }

        let refreshed = new GlideDateTime();
        if (update) {
            audienceGR.setValue("count", count);
            audienceGR.setValue("conditions", newConditions);
            audienceGR.setValue("refreshed", refreshed);
            audienceGR.update();
        }
    },

    refreshAudienceMembers: function({
        audienceSysID,
        update
    }) {
        var startTimer = new GlideDateTime();

        let valid = false;
        let refreshed = '';
        let count = '';

        let audienceGR = new GlideRecord("x_cadso_automate_audience");
        if (!audienceGR.get(audienceSysID)) {
            throw 'Audience Builder: Error getting Audience Record for sysID' + audienceSysID;
        }

        let conditions = audienceGR.getValue('conditions');
        let audienceTable = audienceGR.getValue("table");

		let memberGR = new GlideRecord("x_cadso_automate_audience_member");
		memberGR.addQuery("audience", audienceSysID);
		memberGR.query();
		while (memberGR.next()) {
			let memberData = JSON.parse(memberGR.getValue("member_hash") || {});
			let memberSysId = memberData.sysId;
			
			let memberExistsInHash = false;
			// Check if this member exists in any hash record
			let hashGR = new GlideRecord("x_cadso_automate_audience_hash");
			hashGR.addQuery("audience", audienceSysID);
			hashGR.query();
			while (hashGR.next()) {
				let hashArray = JSON.parse(hashGR.getValue("member_hash") || "[]");
				
				// Check if memberSysId exists in this hash array
				for (let i = 0; i < hashArray.length; i++) {
					if (hashArray[i] && hashArray[i].sysId && hashArray[i].sysId === memberSysId) {
						memberExistsInHash = true;
						break;
					}
				}
			}
			
			if (!memberExistsInHash) {
				// Member no longer exists in current hash, mark for deletion
				memberGR.deleteRecord();
			}
		}

		let hashGR = new GlideRecord("x_cadso_automate_audience_hash");
		hashGR.addQuery("audience", audienceSysID);
		hashGR.query();
		while (hashGR.next()) 
		{
			let hashArray = JSON.parse(hashGR.getValue("member_hash") || "[]");
			
			for (let i = 0; i < hashArray.length; i++)
			{
				let memberExistsInHash = false;
				let memberGR = new GlideRecord("x_cadso_automate_audience_member");
				memberGR.addQuery("audience", audienceSysID);
				memberGR.query();
				while (memberGR.next())
				{
					let memberData = JSON.parse(memberGR.getValue("member_hash") || {});
					let memberSysId = memberData.sysId;
					if (hashArray[i] && hashArray[i].sysId && hashArray[i].sysId === memberSysId) 
					{
						memberExistsInHash = true;
						break;
					}
				}

				if(!memberExistsInHash)
				{
					let audienceMemberGR = new GlideRecord("x_cadso_automate_audience_member");
					let data = JSON.stringify(hashArray[i]);
					let name  = hashArray[i].email.member.name || "";
					audienceMemberGR.initialize();
					audienceMemberGR.setValue("audience", audienceSysID);
					audienceMemberGR.setValue("member_hash", data);
					audienceMemberGR.setValue("name", name);
					audienceMemberGR.insert();
				}
			}
		}
		

        //this is a array for previous members of audience member sysIds along with their hashdata.
        // let previousMembers = this._getPreviousMembers(audienceSysID);

        // //this is a hashmap for members that are currently in the audience using the hashmaps data
        // let currentMembers = this._getCurrentMembers(audienceSysID);

        // const currentSysIds = new Set();
        // const membersToAdd = [];

        // for (const currentMember of currentMembers.values()) {
        //     currentSysIds.add(currentMember.sysId);
        // }

        // const previousSysIds = new Set();
        // const membersToRemove = [];

        // for (const previousMember of previousMembers) {
        //     const innerId = previousMember.memberHash.sysId;
        //     previousSysIds.add(innerId);

        //     if (!currentSysIds.has(innerId)) {
        //         membersToRemove.push(previousMember.sysId); // outer sysId
        //     }
        // }

        // // Determine members to add in one pass over currentMembers
        // for (const currentMember of currentMembers.values()) {
        //     if (!previousSysIds.has(currentMember.sysId)) {
        //         membersToAdd.push(currentMember);
        //     }
        // }

        // gs.info("TO Members to remove: " + membersToRemove.length);
        // gs.info("TO Members to add: " + membersToAdd.length);

        // if (membersToRemove.length != 0) {
        //     this._deleteRemovedMembers(membersToRemove, audienceSysID);
        // }

        // this._addNewMembers(membersToAdd, audienceSysID);

        var endTimer = new GlideDateTime();
        var dur = GlideDateTime.subtract(startTimer, endTimer);
        gs.info("TO: Member Duration is" + dur.getDisplayValue());
    },



    _getPreviousMembers: function(audienceID) {
        let currentMembers = [];
        let memberTableGR = new GlideRecord("x_cadso_automate_audience_member");
        memberTableGR.addQuery("audience", audienceID);
        memberTableGR.query();
        while (memberTableGR.next()) {
            let memberHash = JSON.parse(memberTableGR.getValue("member_hash")) || null;
            if (memberHash) {
                currentMembers.push({
                    sysId: memberTableGR.getValue("sys_id"),
                    memberHash: memberHash
                });
            }
        }
        return currentMembers;
    },

    _getCurrentMembers: function(audienceID) {
        let previousMembers = new Map();
        let previousMembersGR = new GlideRecord("x_cadso_automate_audience_hash");

        previousMembersGR.addQuery("audience", audienceID);
        previousMembersGR.query();

        while (previousMembersGR.next()) {
            let hash = JSON.parse(previousMembersGR.getValue("member_hash"));
            let y = 0;
            for (let x = 0; x < hash.length; x++) {
                if (hash[x]) {
                    if (!previousMembers.get(hash[x].sysId)) {
                        previousMembers.set(hash[x].sysId, hash[x]);
                    }
                } else {
                    y++;
                }
            }
            gs.warn("Audience Members do not have hash data for audience: " + audienceID + " - on Member Hash : " + previousMembersGR.getUniqueValue() + " - # of members " + y);
        }

        return previousMembers;
    },




    _deleteRemovedMembers: function(membersToDelete, audienceID) {
        let audienceMembersGR = new GlideRecord("x_cadso_automate_audience_member");
        audienceMembersGR.addQuery("audience", audienceID);
        audienceMembersGR.addQuery('sys_id', 'IN', membersToDelete);
        audienceMembersGR.query();
        audienceMembersGR.deleteMultiple();
    },

    _addNewMembers: function(membersToAdd, audienceID) {
        let audienceMemberGR = new GlideRecord("x_cadso_automate_audience_member");
        for (let i = 0; i < membersToAdd.length; i++) {
            let data = JSON.stringify(membersToAdd[i])
            audienceMemberGR.initialize();
            audienceMemberGR.setValue("audience", audienceID);
            audienceMemberGR.setValue("member_hash", data);
            audienceMemberGR.setValue("name", membersToAdd[i].email.member.name);
            audienceMemberGR.insert();
        }
    },

    // _updateAudience(audienceID, count, refreshed, conditions) {
    //     let audienceGR = new GlideRecord("x_cadso_automate_audience");
    //     if (audienceGR.get(audienceID)) {
    //         if (conditions) {
    //             audienceGR.setValue("conditions", conditions);
    //         }
    //         audienceGR.setValue("count", count);
    //         audienceGR.setValue("refreshed", refreshed);
    //         audienceGR.update();
    //         return true;
    //     }
    //     return false;
    // },

    // _getContactDetailID: function (email, mobilePhone, table, tableID, name) {
    // 	if(email){
    // 		let emailGR = new GlideRecordSecure('x_cadso_core_email_address');
    // 		emailGR.addQuery('email', email);
    // 		emailGR.addNotNullQuery('contact_detail');
    // 		emailGR.query()
    // 		if(emailGR.next()){
    // 			let contactID = emailGR.getValue('contact_detail');
    // 			let phone = {
    // 				phone_number: mobilePhone,
    // 				contact_detail: contactID
    // 			};
    // 			let phoneGQ = new global.GlideQuery('x_cadso_core_phone_number')
    // 			.getBy(phone)
    // 			.orElse(null);
    // 			if(!phoneGQ){
    // 				phoneGQ = new global.GlideQuery('x_cadso_core_phone_number')
    // 				.insert(phone);
    // 			}
    // 			return contactID;
    // 		}
    // 	}

    // 	if(mobilePhone){
    // 		let phoneGR = new GlideRecordSecure('x_cadso_core_phone_number');
    // 		phoneGR.addQuery('phone_number', mobilePhone);
    // 		phoneGR.addNotNullQuery('contact_detail');
    // 		phoneGR.query();
    // 		if(phoneGR.next()){
    // 			let contactID = phoneGR.getValue('contact_detail');
    // 			if(email){
    // 				let emailObj = {
    // 					email_address: email,
    // 					contact_detail: contactID
    // 				}
    // 				let emailGQ = new global.GlideQuery('x_cadso_core_email')
    // 				.getBy(contactID)
    // 				.orElse(null);
    // 				if(!emailGQ){
    // 					emailGQ = new global.GlideQuery('x_cadso_core_email')
    // 					.insert(emailObj);
    // 				}
    // 			}
    // 			return contactID;
    // 		}
    // 	}

    // 	let contactDetailGR = new GlideRecordSecure("x_cadso_automate_contact_detail");
    //     let field = this.tableFields[table];
    //     contactDetailGR.addQuery(field, tableID);
    // 	contactDetailGR.query();
    // 	if (contactDetailGR.next()) {
    // 		return contactDetailGR.getUniqueValue();
    // 	} else {
    //         let field = this.tableFields[table];
    // 		contactDetailGR.initialize();
    // 		contactDetailGR.setValue("email_address", email);
    // 		contactDetailGR.setValue("phone_number", mobilePhone);
    //         contactDetailGR.setValue(field, tableID);
    // 		contactDetailGR.setValue('name', name);
    // 		contactDetailGR.setWorkflow(false);
    // 		let contactDetailID = contactDetailGR.insert();
    // 		return contactDetailID;
    // 	}
    // },

    // _getContactDetailID: function(email, mobilePhone, table, tableID, name) {
    //     let contactDetailID = null;
    //     if (email) {
    //         contactDetailID = this._getContactDetailByEmail(email);
    //         if (contactDetailID) {
    //             if (mobilePhone) {
    //                 this._getOrInsertPhone(mobilePhone, contactDetailID)
    //             }
    //             return contactDetailID;
    //         }
    //     }

    //     if (mobilePhone) {
    //         contactDetailID = this._getContactDetailByPhone(mobilePhone);
    //         if (contactDetailID) {
    //             if (email) {
    //                 this._getOrInsertEmail(email, contactDetailID)
    //             }
    //             return contactDetailID;
    //         }
    //     }

    //     contactDetailID = this._createContactDetail(table, tableID, name);
    //     if (email) {
    //         this._getOrInsertEmail(email, contactDetailID);
    //     }
    //     if (mobilePhone) {
    //         this._getOrInsertPhone(mobilePhone, contactDetailID)
    //     }
    //     return contactDetailID;
    // },

    // _getContactDetailByEmail: function(email) {
    //     let contactID = null;
    //     let emailGR = new GlideRecordSecure('x_cadso_core_email_address');
    //     emailGR.addQuery('email', email);
    //     emailGR.addNotNullQuery('contact_detail');
    //     emailGR.query();
    //     if (emailGR.next()) {
    //         contactID = emailGR.getValue('contact_detail');
    //     }
    //     return contactID;
    // },

    // _getContactDetailByPhone: function(phone) {
    //     let contactID = null;
    //     let phoneGR = new GlideRecordSecure('x_cadso_core_phone_number');
    //     phoneGR.addQuery('phone_number', phone);
    //     phoneGR.addNotNullQuery('contact_detail');
    //     phoneGR.query();
    //     if (phoneGR.next()) {
    //         contactID = phoneGR.getValue('contact_detail');
    //     }
    //     return contactID;
    // },

    // _getOrInsertEmail: function(email, contactDetailID) {
    //     let emailObj = {
    //         email: email,
    //         contact_detail: contactDetailID
    //     }
    //     let emailGQ = new global.GlideQuery('x_cadso_core_email_address')
    //         .getBy(emailObj)
    //         .orElse(null)
    //     if (!emailGQ) {
    //         emailGQ = new global.GlideQuery('x_cadso_core_email_address')
    //             .insert(emailObj)
    //     }
    //     return (emailGQ.sys_id);
    // },

    // _getOrInsertPhone: function(mobilePhone, contactDetailID) {
    //     let phoneObj = {
    //         phone_number: mobilePhone,
    //         contact_detail: contactDetailID
    //     }
    //     let phoneGQ = new global.GlideQuery('x_cadso_core_phone_number')
    //         .getBy(phoneObj)
    //         .orElse(null)
    //     if (!phoneGQ) {
    //         phoneGQ = new global.GlideQuery('x_cadso_core_phone_number')
    //             .insert(phoneObj);
    //     }
    //     return phoneGQ.sys_id;
    // },

    // _createContactDetail: function(table, tableID, name) {
    //     let tableField = this.tableFields[table]
    //     let contactDetail = {};
    //     contactDetail[tableField] = tableID;
    //     let contactDetailGQ = new global.GlideQuery('x_cadso_automate_contact_detail')
    //         .getBy(contactDetail)
    //         .orElse(null);
    //     if (!contactDetailGQ) {
    //         contactDetailGQ = new global.GlideQuery('x_cadso_automate_contact_detail')
    //             .insert(contactDetail)
    //             .get();
    //     }
    //     return contactDetailGQ.sys_id;
    // },

    type: 'AudienceMS'
};