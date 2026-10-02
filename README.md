# Tinder swipe · Vanilla JS + MongoDB Atlas

Mazo, like/nope y matches. Colecciones `tinder.profiles` y `tinder.swipes`.

```bash
export GCP_PROJECT_ID=project-778283d9-dc7e-4c2c-947
export MONGODB_URI="mongodb+srv://dani:dany2233@cluster0.rqkadaa.mongodb.net/tinder?retryWrites=true&w=majority&authSource=admin&appName=Cluster0"

gcloud run deploy tinder-swipe-vanilla \
  --project $GCP_PROJECT_ID \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --update-env-vars="MONGODB_URI=${MONGODB_URI},MONGODB_DB=tinder"
```
