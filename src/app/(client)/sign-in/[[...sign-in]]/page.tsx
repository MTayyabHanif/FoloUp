import Image from "next/image";
import { SignIn } from "@clerk/nextjs";

function SignInPage() {
  return (
    <div className="flex items-center justify-center h-screen w-full bg-white absolute top-0 left-0 z-50">
      <div className="hidden md:block align-middle my-auto mx-auto">
        <SignIn forceRedirectUrl="/dashboard" />
      </div>
      <div className="block md:hidden px-3 h-[60%] my-auto">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/logo.svg"
            alt="Robust Devs"
            width={64}
            height={64}
            priority
          />
          <h1 className="text-2xl font-bold text-center text-gray-800">
            Welcome to Robust Devs
          </h1>
        </div>
        <h1 className="text-md my-3 text-center text-gray-800">
          Mobile version is currently under construction. 🚧
        </h1>
        <p className="text-center text-gray-600 mt-3">
          Please sign in using a PC for the best experience. Sorry for the inconvenience.
        </p>
      </div>
    </div>
  );
}
export default SignInPage;
