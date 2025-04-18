"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

interface BaseProps {
    children: React.ReactNode;
}

interface RootCredenzaProps extends BaseProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

interface CredenzaProps extends BaseProps {
    className?: string;
    asChild?: true;
}

const desktop = "(min-width: 768px)";

type CredenzaContextType = {
    isDesktop: boolean;
};

const CredenzaContext = React.createContext<CredenzaContextType | null>(null);

const useCredenza = () => {
    const context = React.useContext(CredenzaContext);
    if (!context) {
        throw new Error("Credenza components must be used within a Credenza");
    }
    return context;
};

const Credenza = ({ children, ...props }: RootCredenzaProps) => {
    const isMobile = useIsMobile();
    const isDesktop = !isMobile;

    return (
        <CredenzaContext.Provider value={{ isDesktop }}>
            {isDesktop ? (
                <Dialog {...props}>{children}</Dialog>
            ) : (
                <Drawer {...props}>{children}</Drawer>
            )}
        </CredenzaContext.Provider>
    );
};

const CredenzaTrigger = ({ className, children, ...props }: CredenzaProps) => {
    const { isDesktop } = useCredenza();

    if (isDesktop) {
        return (
            <DialogTrigger className={className} {...props}>
                {children}
            </DialogTrigger>
        );
    }

    return (
        <DrawerTrigger className={className} {...props}>
            {children}
        </DrawerTrigger>
    );
};

const CredenzaClose = ({ className, children, ...props }: CredenzaProps) => {
    const { isDesktop } = useCredenza();

    if (isDesktop) {
        return (
            <DialogClose className={className} {...props}>
                {children}
            </DialogClose>
        );
    }

    return (
        <DrawerClose className={className} {...props}>
            {children}
        </DrawerClose>
    );
};

const CredenzaContent = ({ className, children, ...props }: CredenzaProps) => {
    const { isDesktop } = useCredenza();

    if (isDesktop) {
        return (
            <DialogContent className={cn("flex flex-col", className)} {...props}>
                {children}
            </DialogContent>
        );
    }

    return (
        <DrawerContent
            className={cn("flex flex-col max-h-[90dvh] min-h-[10dvh]", className)}
            {...props}
        >
            {children}
        </DrawerContent>
    );
};

const CredenzaDescription = ({
    className,
    children,
    ...props
}: CredenzaProps) => {
    const { isDesktop } = useCredenza();

    if (isDesktop) {
        return (
            <DialogDescription className={cn(className)} {...props}>
                {children}
            </DialogDescription>
        );
    }

    return (
        <DrawerDescription className={cn(className)} {...props}>
            {children}
        </DrawerDescription>
    );
};

const CredenzaHeader = ({ className, children, ...props }: CredenzaProps) => {
    const { isDesktop } = useCredenza();

    if (isDesktop) {
        return (
            <DialogHeader className={className} {...props}>
                {children}
            </DialogHeader>
        );
    }

    return (
        <DrawerHeader className={className} {...props}>
            {children}
        </DrawerHeader>
    );
};

const CredenzaTitle = ({ className, children, ...props }: CredenzaProps) => {
    const { isDesktop } = useCredenza();

    if (isDesktop) {
        return (
            <DialogTitle className={cn(className)} {...props}>
                {children}
            </DialogTitle>
        );
    }

    return (
        <DrawerTitle className={cn(className)} {...props}>
            {children}
        </DrawerTitle>
    );
};

const CredenzaBody = ({ className, children, ...props }: CredenzaProps) => {
    const { isDesktop } = useCredenza();

    return (
        <div
            className={cn("px-4 md:px-0", className, {
                "h-full overflow-y-scroll pb-10": !isDesktop
            })}
            {...props}
        >
            {children}
        </div>
    );
};

const CredenzaFooter = ({ className, children, ...props }: CredenzaProps) => {
    const { isDesktop } = useCredenza();

    if (isDesktop) {
        return (
            <DialogFooter className={className} {...props}>
                {children}
            </DialogFooter>
        );
    }

    return (
        <DrawerFooter className={className} {...props}>
            {children}
        </DrawerFooter>
    );
};

export {
    Credenza,
    CredenzaTrigger,
    CredenzaClose,
    CredenzaContent,
    CredenzaDescription,
    CredenzaHeader,
    CredenzaTitle,
    CredenzaBody,
    CredenzaFooter
};
