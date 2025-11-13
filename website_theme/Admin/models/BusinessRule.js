const mongoose = require('mongoose');

const businessRuleSchema = new mongoose.Schema({
    category: String,
    description: String,
    constraints: [String],
    claudeConversation: String,
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BusinessRule', businessRuleSchema);