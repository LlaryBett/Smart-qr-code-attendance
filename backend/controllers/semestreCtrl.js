const Semestre = require('../models/Semestres.js');
const Filiere = require('../models/Filieres.js');
const Professeur = require('../models/Professeurs.js');
const Element = require('../models/Elements.js');

// Create a semestre
exports.createSemestre = async (req, res) => {
    try {
        const { nomSemestre, filiere, elements, seances } = req.body; // Destructure fields from request body

        // Check if the semestre with the same name already exists
        const existingSemestre = await Semestre.findOne({ nomSemestre });
        if (existingSemestre) {
            return res.status(400).json({ success: false, message: 'Semestre with the same name already exists' });
        }

        // Validate if filiere exists
        if (filiere && !(await Filiere.findById(filiere))) {
            return res.status(400).json({ success: false, message: 'Invalid filiere ID' });
        }

        // Create the semestre
        const semestre = new Semestre({
            nomSemestre,
            filiere,
            elements,
            seances
        });

        // Save the semestre to the database
        await semestre.save();

        // Return success response
        res.status(201).json({ success: true, semestre });
    } catch (error) {
        console.error('Error creating semestre:', error);
        res.status(500).json({ success: false, message: 'An error occurred', error: error.message });
    }
};

// Get all semestres
exports.GetSemestre = (req, res) => {
    Semestre.find()
        .populate('filiere', 'nomFiliere')
        .populate('elements', 'nomElement')
        .lean() // Use lean for performance optimization
        .then(semestres => {
            const semestresPopulate = semestres.map(semestre => {
                const semestrePopulate = {
                    _id: semestre._id
                };

                if (semestre.filiere) {
                    semestrePopulate.filiere = semestre.filiere;
                }

                if (semestre.professeurs && semestre.professeurs.length > 0) {
                    semestrePopulate.professeurs = semestre.professeurs;
                }

                if (semestre.elements && semestre.elements.length > 0) {
                    semestrePopulate.elements = semestre.elements;
                }

                return semestrePopulate;
            });
            res.status(200).json(semestresPopulate);
        })
        .catch(error => {
            res.status(500).json({ success: false, message: 'An error occurred', error: error.message });
        });
};

// Get semestre by ID
exports.GetSemestreById = (req, res) => {
    const semestreId = req.params.id;

    Semestre.findById(semestreId)
        .populate('filiere', 'nomFiliere')
        .populate('professeurs', 'nom prenom')
        .populate('elements', 'nomElement')
        .then(semestre => {
            if (!semestre) {
                return res.status(404).json({ success: false, message: "Semestre not found" });
            }

            const semestrePopulate = {
                _id: semestre._id
            };

            // Log the populated data for debugging
            console.log('Populated Semestre:', semestre);

            if (semestre.filiere) {
                semestrePopulate.filiere = { nomFiliere: semestre.filiere.nomFiliere };
            }

            if (semestre.professeurs && semestre.professeurs.length > 0) {
                semestrePopulate.professeurs = semestre.professeurs.map(prof => ({ nom: prof.nom, prenom: prof.prenom }));
            }

            if (semestre.elements && semestre.elements.length > 0) {
                semestrePopulate.elements = semestre.elements.map(element => ({ nomElement: element.nomElement }));
            }

            res.status(200).json(semestrePopulate);
        })
        .catch(error => {
            console.error('Error fetching semestre:', error);
            res.status(500).json({ success: false, message: 'An error occurred', error: error.message });
        });
};

// Delete a semestre
exports.Deletesemestre = async (req, res) => {
    const semestreId = req.params.id;

    const session = await mongoose.startSession();
    session.startTransaction(); // Start a new transaction

    try {
        // Delete the semestre
        const deletedSemestre = await Semestre.findByIdAndDelete(semestreId).session(session);
        
        if (!deletedSemestre) {
            await session.abortTransaction(); // Abort transaction if semestre not found
            return res.status(404).json({ message: "Semestre not found" });
        }

        // Clean up references in other collections
        const promises = [
            Professeur.updateMany({ semestres: semestreId }, { $pull: { semestres: semestreId } }).session(session),
            Element.updateMany({ semestres: semestreId }, { $pull: { semestres: semestreId } }).session(session),
            Filiere.updateMany({ semestres: semestreId }, { $pull: { semestres: semestreId } }).session(session)
        ];

        await Promise.all(promises);

        // Commit the transaction if everything succeeds
        await session.commitTransaction();
        
        res.status(200).json({ message: "Semestre deleted successfully" });

    } catch (error) {
        // Abort the transaction if there is an error
        await session.abortTransaction();
        console.error('Error during semestre deletion:', error);
        res.status(500).json({ error: error.message });
    } finally {
        // End the session
        session.endSession();
    }
};

// Update a semestre
exports.Updatesemestre = (req, res) => {
    const semestreId = req.params.id;

    Semestre.findByIdAndUpdate(semestreId, req.body, { new: true })
        .then(updatedSemestre => {
            if (!updatedSemestre) {
                return res.status(404).json({ success: false, message: "Semestre not found" });
            }

            const promises = [];
            promises.push(Professeur.updateMany({}, { $addToSet: { semestres: updatedSemestre._id } }));
            promises.push(Element.updateMany({}, { $addToSet: { semestres: updatedSemestre._id } }));
            promises.push(Filiere.updateMany({}, { $addToSet: { semestres: updatedSemestre._id } }));

            return Promise.all(promises)
                .then(() => {
                    res.status(200).json({ success: true, message: "Semestre updated successfully", semestre: updatedSemestre });
                })
                .catch(error => {
                    res.status(500).json({ success: false, message: 'An error occurred', error: error.message });
                });
        })
        .catch(error => {
            res.status(500).json({ success: false, message: 'An error occurred', error: error.message });
        });
};

// The below code is commented out but remains part of the full code
/*
exports.GetSemestre = (req, res) => {
    Semestre.find()
        .populate('filiere', 'nomFiliere') 
        .populate('professeurs', 'nom prenom') 
        .populate('elements', 'nomElement') 
        .then(semestres => {
            res.status(200).json(semestres);
        })
        .catch(error => {
            res.status(500).json({ error });
        });
};

exports.GetSemestre = (req, res) => {
    Semestre.find()
        .populate('filiere', 'nomFiliere') 
        .populate({path:'filiere',select:"nomFiliere -_id"})
        .populate('professeurs', 'nom prenom', null, { skipInvalidIds: true }) 
        .populate('elements', 'nomElement', null, { skipInvalidIds: true }) 
        .then(semestres => {
            res.status(200).json(semestres);
        })
        .catch(error => {
            res.status(500).json({ error });
        });
};
*/

exports.GetSemestreById = (req, res) => {
    const semestreId = req.params.id;

    Semestre.findById(semestreId)
        .populate('filiere', 'nomFiliere')
        .populate('professeurs', 'nom prenom')
        .populate('elements', 'nomElement')
        .then(semestre => {
            if (!semestre) {
                return res.status(404).json({ message: "Semestre not found" });
            }
            res.status(200).json(semestre);
        })
        .catch(error => {
            res.status(500).json({ error });
        });
};
