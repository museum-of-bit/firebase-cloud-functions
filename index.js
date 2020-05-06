const functions = require("firebase-functions");
const admin = require("firebase-admin");
const request = require("graphql-request");

var serviceAccount = require("./serviceAccountKey.json");

const client = new request.GraphQLClient('https://###.herokuapp.com/v1/graphql', {
    headers: {
        "content-type": "application/json",
        "x-hasura-admin-secret": "############" 
    }
})
//admin.initializeApp(functions.config().firebase);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // databaseURL: "https://punglo.firebaseio.com"
  });

// REGISTER USER WITH REQUIRED CUSTOM CLAIMS
exports.registerUser = functions.https.onRequest(async (req, res) => {
    const email = req.body.email;
    const phoneNumber = req.body.phoneNumber;
    const password = req.body.password;
   
    if (email === null || phoneNumber === null || password === null) {
        throw new functions.https.HttpsError('signup-failed', 'missing information');
    }
    
    try {
        var userRecord = await admin.auth().createUser({
            email: email,
            phoneNumber: phoneNumber,
            password: password,
        });

        admin.auth().setCustomUserClaims(userRecord.uid,  {
            "https://hasura.io/jwt/claims" : {
                "x-hasura-default-role": 'user',
                "x-hasura-allowed-roles": "user",
                "x-hasura-user-id": userRecord.uid
            // eslint-disable-next-line promise/always-return
            }} ).then(() => {
            res.send(userRecord.toJSON());
            }).catch((error) => {
            console.info(error)
                throw new functions.https.HttpsError('claims failed', JSON.stringify(error, undefined, 2));
        })

    } catch (e) {
        throw new functions.https.HttpsError('signup-failed', JSON.stringify(error, undefined, 2));
    }
});

// UPDATE USER EMAIL AND PHONE
exports.updateUser = functions.https.onRequest(async (req, res) => {
    const uid = req.body.uid;
    const email = req.body.email;
    const phoneNumber = req.body.phoneNumber;

    if (uid === null || email === null || phoneNumber === null) {
        throw new functions.https.HttpsError('update-failed', 'missing information');
    }
    
    try {
        admin.auth().updateUser(uid,  {
            uid: req.body.uid,
            email: req.body.email,
            phoneNumber: req.body.phoneNumber
            // eslint-disable-next-line promise/always-return
            }).then(() => {
            res.send(uid);
            }).catch((error) => {
             console.info(error)
                throw new functions.https.HttpsError('update-failed', JSON.stringify(error, undefined, 2));
         })

        } catch (e) {
            throw new functions.https.HttpsError('update-failed', JSON.stringify(error, undefined, 2));
        }

});

// UPGRADE CLAIMS MANAGER
exports.upgradeClaims = functions.https.onRequest(async (req, res) => {
    const isman = req.body.isman;
    const uid = req.body.uid;
    const orgid = req.body.orgid;
    const licid = req.body.licid;

    if (isman === null || uid === null || orgid === null || licid === null) {
        throw new functions.https.HttpsError('upgrade-claims-manager-failed', 'missing information');
    }
    
    if (isman === true){
        try {        
            admin.auth().setCustomUserClaims(uid,  {
                "https://hasura.io/jwt/claims" : {
                    "x-hasura-default-role": 'manager',
                    "x-hasura-allowed-roles": ["user", "manager"],
                    "x-hasura-user-id": uid,
                    "x-hasura-org-id": orgid,
                    "x-hasura-custom": licid
                // eslint-disable-next-line promise/always-return
                }} ).then(() => {
                res.send(orgid);
                }).catch((error) => {
                 console.info(error)
                    throw new functions.https.HttpsError('claims failed', JSON.stringify(error, undefined, 2));
             })
    
        } catch (e) {
            throw new functions.https.HttpsError('upgrade-claims-manager-failed', JSON.stringify(error, undefined, 2));
        }
    } else {
        try {        
            admin.auth().setCustomUserClaims(uid,  {
                "https://hasura.io/jwt/claims" : {
                    "x-hasura-default-role": 'user',
                    "x-hasura-allowed-roles": "user",
                    "x-hasura-user-id": uid,
                    "x-hasura-org-id": orgid,
                    "x-hasura-custom": licid
                // eslint-disable-next-line promise/always-return
                }} ).then(() => {
                res.send(orgid);
                }).catch((error) => {
                 console.info(error)
                    throw new functions.https.HttpsError('claims failed', JSON.stringify(error, undefined, 2));
             })
    
        } catch (e) {
            throw new functions.https.HttpsError('upgrade-claims-employee-failed', JSON.stringify(error, undefined, 2));
        }        
    }
});

//
// DOWNGRADE CLAIMS
exports.downgradeClaims = functions.https.onRequest(async (req, res) => {
    const uid = req.body.uid;

    if (uid === null) {
        throw new functions.https.HttpsError('downgrade-claims-failed', 'missing information');
    }
    
    try {
        admin.auth().setCustomUserClaims(uid,  {
            "https://hasura.io/jwt/claims" : {
                "x-hasura-default-role": 'user',
                "x-hasura-allowed-roles": ["user"],
                "x-hasura-user-id": uid
            // eslint-disable-next-line promise/always-return
            }} ).then(() => {
            res.send(uid);
            }).catch((error) => {
             console.info(error)
                throw new functions.https.HttpsError('claims failed', JSON.stringify(error, undefined, 2));
         })

    } catch (e) {
        throw new functions.https.HttpsError('downgrade-claims-failed', JSON.stringify(error, undefined, 2));
    }
});

// SYNC WITH HASURA ON USER UPDATE
// exports.processUpdate = functions.auth.user().onUpdate(async user => {
//    const email = user.email;
//    const phoneNumber = user.phoneNumber;
//
//    const mutation = ``;
//
//try {
//    const data = await client.request(mutation, {
//        id: id,
//        email: email,
//        phoneNumber: phoneNumber
//    })
//
//    return data;
//} catch (e) {
//    throw new functions.https.HttpsError('sync-failed');
//
//}
// }); 

// SYNC WITH HASURA ON USER CREATE
exports.processSignUp = functions.auth.user().onCreate(async user => {

    const id = user.uid;
    const email = user.email;
    const phoneNumber = user.phoneNumber;
    const mutation = `mutation InsertUser($id: String!, $email: String, $phoneNumber: numeric) {
        insert_personas(objects: {user_id: $id, phones: {data: {phoneNumber: $phoneNumber}}, emails: {data: {email: $email}}, users: {data: {id: $id}}}) {
          returning {
            id
            phones {
              phoneNumber
              persona_id
            }
            emails {
              email
              persona_id
            }
            users {
              id
              persona_id
            }
          }
        }
      }`;
    
    try {
        const data = await client.request(mutation, {
            id: id,
            email: email,
            phoneNumber: phoneNumber
        })

        return data;
    } catch (e) {
        throw new functions.https.HttpsError('sync-failed');
   
    }
});

//
// SYNC WITH HASURA ON USER DELETE
exports.processDelete = functions.auth.user().onDelete(async (user) => {
    const mutation = `mutation($id: String!) {
        delete_users(where: {id: {_eq: $id}}) {
          affected_rows
        }
    }`;
    const id = user.uid;
    try {
        const data = await client.request(mutation, {
            id: id,
        })
        return data;
    } catch (e) {
        throw new functions.https.HttpsError('sync-failed');

    }
});
