// Update script to add sys_class_name to previously created sysauto records
// This ensures they have the mandatory field for proper ServiceNow functionality

// List of sys_ids for the scheduled jobs we created earlier
var jobSysIds = [
    '3a78b38ec3007e50d4ddf1db05013150', // Original "DO NOT PUSH: Create Contacts"
    '511e7746c3407e50d4ddf1db05013191'  // Enhanced "DO NOT PUSH: Create Contacts v2"
];

jobSysIds.forEach(function(sysId) {
    var job = new GlideRecord('sysauto');
    if (job.get(sysId)) {
        // Check if sys_class_name is already set
        if (!job.sys_class_name || job.sys_class_name == '') {
            // Set to sysauto_script since these jobs have scripts
            job.sys_class_name = 'sysauto_script';
            job.update();
            gs.info('Updated job "' + job.name + '" with sys_class_name: sysauto_script');
        } else {
            gs.info('Job "' + job.name + '" already has sys_class_name: ' + job.sys_class_name);
        }
    } else {
        gs.warn('Could not find sysauto record with sys_id: ' + sysId);
    }
});

gs.info('Completed updating sysauto records with mandatory sys_class_name field');