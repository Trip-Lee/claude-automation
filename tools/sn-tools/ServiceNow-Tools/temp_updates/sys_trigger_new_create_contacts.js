// CREATE_NEW_RECORD: sys_trigger
// This will create a new scheduled job for contact generation
// Format: CREATE_NEW_RECORD: [table_name]
// Then provide the script content below

// Scheduled Job: DO NOT PUSH: Create Contacts
// This job creates customer contact records in bulk with random data

// Configuration - adjust the number of records to create
var recordsToCreate = gs.getProperty('contact.generation.count', '2500000'); // Default 2.5M
var batchSize = 1000; // Process in batches to avoid timeout

// Initialize counters
var totalRecords = parseInt(recordsToCreate);
var processedRecords = 0;
var currentBatch = 0;

gs.info('Starting contact generation job - Target: ' + totalRecords + ' records');

// Helper function to generate random string
function generateRandomString(length) {
    var chars = 'abcdefghijklmnopqrstuvwxyz';
    var result = '';
    for (var i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Helper function to capitalize first letter
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Process records in batches
while (processedRecords < totalRecords) {
    currentBatch++;
    var remainingRecords = totalRecords - processedRecords;
    var currentBatchSize = Math.min(batchSize, remainingRecords);

    gs.info('Processing batch ' + currentBatch + ' - Creating ' + currentBatchSize + ' records');

    // Create batch of customer contacts
    for (var i = 0; i < currentBatchSize; i++) {
        try {
            // Generate random names (5-10 characters)
            var firstNameLength = Math.floor(Math.random() * 6) + 5; // 5-10 chars
            var lastNameLength = Math.floor(Math.random() * 6) + 5;  // 5-10 chars

            var firstName = capitalize(generateRandomString(firstNameLength));
            var lastName = capitalize(generateRandomString(lastNameLength));
            var userId = firstName.toLowerCase() + '.' + lastName.toLowerCase();
            var email = userId + '@TenonTest.com';

            // Create customer contact record
            var contact = new GlideRecord('customer_contact');
            contact.initialize();
            contact.first_name = firstName;
            contact.last_name = lastName;
            contact.user_id = userId;
            contact.email = email;

            // Insert the record
            var sysId = contact.insert();

            if (sysId) {
                processedRecords++;
            } else {
                gs.error('Failed to create contact: ' + firstName + ' ' + lastName);
            }

        } catch (e) {
            gs.error('Error creating contact record: ' + e.message);
        }
    }

    // Log progress every 10 batches
    if (currentBatch % 10 === 0) {
        gs.info('Progress: ' + processedRecords + '/' + totalRecords + ' records created (' +
                Math.round((processedRecords/totalRecords)*100) + '%)');
    }

    // Small delay between batches to prevent overwhelming the system
    if (currentBatch % 50 === 0) {
        gs.sleep(100); // 100ms pause every 50 batches
    }
}

gs.info('Contact generation job completed - Created ' + processedRecords + ' records');