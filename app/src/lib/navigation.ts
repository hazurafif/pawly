import { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

// Back navigation that never throws: when there is no history (a form
// opened directly, or a reload at a modal route), fall back to Home.
export function goBack(router: Router): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}
