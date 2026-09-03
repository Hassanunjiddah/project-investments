import { Redirect } from 'expo-router';

/** Old nested path blanked on RN-web; wizard now lives at /project-create. */
export default function CreateProjectRedirect() {
  return <Redirect href="/project-create" />;
}
