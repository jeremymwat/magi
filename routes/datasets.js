// Load required modules
var	mongoose = require( 'mongoose' ),
	Database = require('../model/db'),
	Dataset  = require( "../model/datasets" );

// Renders a list of manifests
exports.manifests = function manifests(req, res){
	console.log('/manifests');
	res.render('manifests', { user: req.user });
}

// Renders list of all datasets
exports.index = function index(req, res){
	console.log('/datasets/index')
	Dataset.datasetGroups({is_public: true}, function(err, publicGroups){
		// Throw error (if necessary)
		if (err) throw new Error(err);

		// Append the groupClass public to each group
		publicGroups.forEach(function(g){
			g.dbs = g.dbs.sort(function(a, b){ return a.title > b.title ? 1 : -1; });
		});


		var groupData = [{groups: publicGroups, ty: "public"}];

		// Load the user's datasets (if necessary)
		if (req.user){
			Dataset.datasetGroups({user_id: req.user._id}, function(err, userGroups){
				// Throw error (if necessary)
				if (err) throw new Error(err);

				// Append the groupClass standard to each group
				userGroups.forEach(function(g){
					g.dbs = g.dbs.sort(function(a, b){ return a.title > b.title ? 1 : -1; });
				});

				if (userGroups.length > 0){
					groupData = [{groups: userGroups, ty: "user"}, groupData[0]];
				}

				res.render('datasets/index', { user: req.user, groupClasses: groupData });
			});
		}
		else{
			res.render('datasets/index', { user: req.user, groupClasses: groupData });
		}
	});
}

exports.view = function view(req, res){
	// Parse params
	var dbID = req.params.datasetID || "";

	// Retrieve the dataset
	var MongoDataset = Database.magi.model( 'Dataset' );
	MongoDataset.findById(dbID, function(err, db){
		// Throw error (if necessary)
		if (!db || err){
			res.redirect('/datasets');
			return;
		}

		// Check if the dataset is standard, and render it if it is
		// or if the user owns the database (add the "" to make sure)
		// the id is a string and not an ObjectId
		if (db.is_public || (db.user_id + "") == (req.user._id + "")){
			res.render('datasets/view', { user: req.user, db: db });
		}
		else{
			res.redirect('/datasets');
		}
	});
}
