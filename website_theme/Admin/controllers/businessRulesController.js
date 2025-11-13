const BusinessRule = require('../models/BusinessRule');

exports.getBusinessRules = async (req, res) => {
    try {
        const rules = await BusinessRule.find();
        res.render('business-rules/index', {
            title: 'Business Rules',
            rules: rules,
            HeaderCss: '',
            error: req.query.error ? 'There was an error adding the business rule.' : null
        });
    } catch (error) {
        console.error('Error fetching business rules:', error);
        res.status(500).render('error', { 
            title: 'Error',
            message: 'An error occurred while fetching business rules.',
            HeaderCss: ''
        });
    }
};

exports.addBusinessRule = async (req, res) => {

    console.log('Request Body:', req.body);
    console.log('Request Params:', req.params);
    console.log('Request Query:', req.query);

    try {
        const { category, description, constraints, claudeConversation } = req.body;
        const rule = new BusinessRule({
            category,
            description,
            constraints: constraints,
            claudeConversation
        });
        await rule.save();
        
        // After saving, redirect to the business rules page
        return res.redirect('/business-rules');
    } catch (error) {
        console.error('Error adding business rule:', error);
        // If there's an error, redirect to an error page or back to the form
        return res.redirect('/business-rules?error=true');
    }
};